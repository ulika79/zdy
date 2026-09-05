/**
 * AI 服务器代理网关 · 腾讯云 EdgeOne Pages 边缘函数版（推荐国内使用）
 * ==================================================================
 * 文件位置（必须保持这个路径，EdgeOne 按目录自动生成路由）：
 *   functions/api/[[default]].js
 * 部署后自动获得路由：https://你的Pages域名/api/*
 *
 * tools.html 里的用法：点 🛡️ 代理，地址填 https://你的Pages域名/api
 *
 * 环境变量（在 EdgeOne Pages 控制台 → 项目设置 → 环境变量 中配置）：
 *   AUTODL_TOKEN  你的 AutoDL API Token（必填）
 *   COMFYUI_BASE  ComfyUI 服务器地址，如 https://xxxxx.seetacloud.com:8443（必填）
 *   CLIENT_KEY    客户密钥（可选）：设置后只有拿到密钥的人才能用
 *
 * 详细部署步骤见《代理部署指南.md》方案A。代码整体可直接使用，无需改动。
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Key',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};

const AUTODL_ORIGIN = 'https://www.autodl.art';

export async function onRequest(context) {
  const { request, env } = context;

  // 1. 预检请求直接放行（跨域必需）
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  // 本函数挂在 /api/* 下，剥掉 /api 前缀得到真实路径
  let path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';

  // 2. 客户密钥校验（支持三种携带方式：路径 /k/密钥/、请求头、查询参数）
  if (env.CLIENT_KEY) {
    let key = request.headers.get('X-Client-Key') || url.searchParams.get('key') || '';
    const m = path.match(/^\/k\/([^/]+)(\/.*)?$/);
    if (m) { key = decodeURIComponent(m[1]); path = m[2] || '/'; }
    if (key !== env.CLIENT_KEY) {
      return jsonResp({ code: 'Unauthorized', msg: '客户密钥不正确，请联系管理员获取' }, 401);
    }
  } else {
    // 未设 CLIENT_KEY 时，兼容带 /k/xxx 前缀的写法，直接剥掉
    const m = path.match(/^\/k\/[^/]+(\/.*)?$/);
    if (m) path = m[2] || '/';
  }

  // 3. AutoDL 接口：注入真正的 Token 转发
  if (path === '/autodl' || path.startsWith('/autodl/')) {
    if (!env.AUTODL_TOKEN) {
      return jsonResp({ code: 'NoToken', msg: '尚未配置 AUTODL_TOKEN，请到 EdgeOne Pages 项目设置添加环境变量' }, 500);
    }
    const target = AUTODL_ORIGIN + path.slice('/autodl'.length) + url.search;
    return proxyFetch(request, target, { 'Authorization': env.AUTODL_TOKEN });
  }

  // 4. ComfyUI 接口：转发到真实服务器（地址锁在环境变量里）
  if (path === '/comfy' || path.startsWith('/comfy/')) {
    if (!env.COMFYUI_BASE) {
      return jsonResp({ code: 'NoBase', msg: '尚未配置 COMFYUI_BASE，请到 EdgeOne Pages 项目设置添加环境变量' }, 500);
    }
    const target = env.COMFYUI_BASE.replace(/\/+$/, '') + path.slice('/comfy'.length) + url.search;
    return proxyFetch(request, target, {});
  }

  // 5. 其他路径
  return jsonResp({
    code: 'NotFound',
    msg: '路径不存在',
    usage: '本代理支持两个前缀：/api/autodl/*（服务器开关机）、/api/comfy/*（AI生成）',
  }, 404);
}

/** 转发请求到目标地址，白名单式复制请求头，避免把客户端头原样带过去 */
async function proxyFetch(request, target, extraHeaders) {
  try {
    const headers = new Headers();
    const ct = request.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
    const accept = request.headers.get('Accept');
    if (accept) headers.set('Accept', accept);
    for (const k of Object.keys(extraHeaders)) headers.set(k, extraHeaders[k]);

    const init = { method: request.method, headers, redirect: 'follow' };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer();
    }

    const resp = await fetch(target, init);
    const outHeaders = new Headers(resp.headers);
    for (const k of Object.keys(CORS_HEADERS)) outHeaders.set(k, CORS_HEADERS[k]);
    // 解压后的 body 长度会变，删掉可能引起浏览器报错的头
    outHeaders.delete('Content-Encoding');
    outHeaders.delete('Content-Length');
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: outHeaders });
  } catch (e) {
    return jsonResp({ code: 'ProxyError', msg: '代理转发失败：' + (e && e.message ? e.message : String(e)) }, 502);
  }
}

function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}
