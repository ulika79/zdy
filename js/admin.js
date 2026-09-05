/* ============================================================
   内容管理后台
   · 页面/区块/文章/图片/视频/音频 可视化增删改
   · 保存预览(localStorage) / 导出content.js / GitHub API一键发布
   ============================================================ */
(function () {
  "use strict";

  /* ================= 状态 ================= */
  var DRAFT_KEY = "siteContentDraft";
  var PREVIEW_KEY = "siteContentPreview";
  var GH_KEY = "ghPublishConfig";

  var state = {
    content: null,
    currentTabIndex: null,   // pages 数组索引
    expandedSection: -1,
    dirty: false,
    mediaQueue: []           // {path, base64} 待发布媒体
  };

  function loadDraft() {
    try {
      var s = localStorage.getItem(DRAFT_KEY);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return JSON.parse(JSON.stringify(window.SITE_CONTENT));
  }
  function saveDraftLocal() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state.content));
    state.dirty = true;
    updateStatusBar();
  }

  /* ================= 工具 ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function log(msg, cls) {
    var box = $("logBox");
    if (box.textContent === "等待操作…") box.textContent = "";
    var line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = new Date().toLocaleTimeString() + "  " + msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }
  function updateStatusBar() {
    $("statusBar").innerHTML = state.dirty
      ? '<span class="status-dot dot-draft"></span>有未发布的修改（已存本机草稿）— 保存预览可在「查看网站」中生效，正式生效需发布到GitHub'
      : '<span class="status-dot dot-published"></span>与已发布版本一致';
  }
  function uid() { return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ================= 区块类型定义 ================= */
  var SECTION_TYPES = {
    hero:    { icon: "🎯", name: "横幅大图", desc: "页面顶部主视觉",
      fields: [
        { k: "title", l: "大标题" },
        { k: "subtitle", l: "副标题" },
        { k: "desc", l: "描述文字", type: "textarea" }
      ],
      lists: [ { k: "buttons", l: "按钮", itemLabel: "按钮", fields: [{ k: "text", l: "文字" }, { k: "url", l: "链接(如 #/cases)" }], tpl: { text: "按钮文字", url: "#/home" } } ] },
    stats:   { icon: "📊", name: "数据看板", desc: "大数字 + 说明",
      fields: [{ k: "title", l: "标题" }, { k: "subtitle", l: "副标题(可空)" }],
      lists: [ { k: "items", l: "数据项", itemLabel: "数据", fields: [{ k: "num", l: "数字(如 480亿)" }, { k: "label", l: "说明" }], tpl: { num: "100万+", label: "数据说明" } } ] },
    cards:   { icon: "🗂️", name: "卡片组", desc: "要点/案例/服务卡片",
      fields: [{ k: "title", l: "标题" }, { k: "subtitle", l: "副标题(可空)" }],
      lists: [ { k: "items", l: "卡片", itemLabel: "卡片", fields: [{ k: "icon", l: "图标(emoji)" }, { k: "title", l: "标题" }, { k: "desc", l: "描述", type: "textarea" }, { k: "badge", l: "角标(可空,如 推荐)" }], tpl: { icon: "✨", title: "卡片标题", desc: "卡片描述" } } ] },
    article: { icon: "📝", name: "图文文章", desc: "富文本正文(支持HTML)",
      fields: [
        { k: "title", l: "文章标题" },
        { k: "subtitle", l: "副标题(可空)" },
        { k: "html", l: "正文内容", type: "htmlarea", hint: "支持HTML标签：&lt;h3&gt;小标题&lt;/h3&gt;、&lt;p&gt;段落&lt;/p&gt;、&lt;strong&gt;加粗&lt;/strong&gt;、&lt;ul&gt;&lt;li&gt;列表&lt;/li&gt;&lt;/ul&gt;、&lt;table&gt;表格&lt;/table&gt;、&lt;a href=\"链接\"&gt;超链接&lt;/a&gt;、&lt;img src=\"图片地址\"&gt;" }
      ], lists: [] },
    steps:   { icon: "🪜", name: "步骤流程", desc: "有序步骤说明",
      fields: [{ k: "title", l: "标题" }, { k: "subtitle", l: "副标题(可空)" }],
      lists: [ { k: "items", l: "步骤", itemLabel: "步骤", fields: [{ k: "title", l: "步骤标题" }, { k: "desc", l: "步骤说明", type: "textarea" }], tpl: { title: "第X步：...", desc: "说明" } } ] },
    gallery: { icon: "🖼️", name: "图片画廊", desc: "图片网格展示",
      fields: [{ k: "title", l: "标题" }, { k: "subtitle", l: "副标题(可空)" }],
      lists: [ { k: "items", l: "图片", itemLabel: "图片", media: true, fields: [{ k: "src", l: "图片地址", media: "image" }, { k: "caption", l: "图片说明" }], tpl: { src: "", caption: "图片说明" } } ] },
    videos:  { icon: "🎬", name: "视频集", desc: "视频/嵌入播放",
      fields: [{ k: "title", l: "标题" }, { k: "subtitle", l: "副标题(可空)" }],
      lists: [ { k: "items", l: "视频", itemLabel: "视频", media: true, fields: [{ k: "src", l: "视频地址(mp4直链或B站/YouTube嵌入链接)", media: "video" }, { k: "poster", l: "封面图地址(可空)", media: "image" }, { k: "caption", l: "视频说明" }], tpl: { src: "", poster: "", caption: "视频说明" } } ] },
    audio:   { icon: "🎧", name: "音频列表", desc: "音频节目/播客",
      fields: [{ k: "title", l: "标题" }, { k: "subtitle", l: "副标题(可空)" }],
      lists: [ { k: "items", l: "音频", itemLabel: "音频", media: true, fields: [{ k: "title", l: "音频标题" }, { k: "desc", l: "时长/简介(可空)" }, { k: "src", l: "音频地址(mp3直链)", media: "audio" }], tpl: { title: "第X期：...", desc: "简介", src: "" } } ] },
    pricing: { icon: "💳", name: "价格套餐", desc: "服务/套餐定价卡",
      fields: [{ k: "title", l: "标题" }, { k: "subtitle", l: "副标题(可空)" }],
      lists: [ { k: "items", l: "套餐", itemLabel: "套餐", fields: [{ k: "name", l: "套餐名" }, { k: "price", l: "价格" }, { k: "desc", l: "适用人群" }, { k: "featured", l: "推荐(填1加推荐角标)" }, { k: "features", l: "卖点(每行一条)", type: "textarea" }], tpl: { name: "套餐名", price: "¥xx", desc: "适合：", features: "卖点1\n卖点2" } } ] },
    faq:     { icon: "❓", name: "常见问题", desc: "问答折叠列表",
      fields: [{ k: "title", l: "标题" }, { k: "subtitle", l: "副标题(可空)" }],
      lists: [ { k: "items", l: "问答", itemLabel: "问答", fields: [{ k: "q", l: "问题" }, { k: "a", l: "回答", type: "textarea" }], tpl: { q: "问题？", a: "回答。" } } ] },
    cta:     { icon: "📣", name: "行动号召", desc: "转化引导(自动带联系方式)",
      fields: [{ k: "title", l: "标题" }, { k: "desc", l: "描述" }],
      lists: [ { k: "buttons", l: "按钮", itemLabel: "按钮", fields: [{ k: "text", l: "文字" }, { k: "url", l: "链接" }], tpl: { text: "联系我", url: "#/cooperation" } } ] }
  };

  /* ================= 顶部操作 ================= */
  $("btnSavePreview").onclick = function () {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(state.content));
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state.content));
    log("已保存预览 → 打开网站即可查看（发布前仅本机可见）");
    alert("✅ 已保存！点击顶部「查看网站」即可预览效果。\n\n注意：这只是本机预览，正式上线需要「发布到GitHub」或手动替换仓库里的 content.js。");
  };

  $("btnPublish").onclick = doPublish;
  $("btnPublish2").onclick = doPublish;

  /* ================= Tab 切换 ================= */
  document.querySelectorAll(".tab").forEach(function (t) {
    t.onclick = function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      ["pages", "site", "publish"].forEach(function (name) {
        $("tab-" + name).style.display = (t.dataset.tab === name) ? "" : "none";
      });
    };
  });

  /* ================= 页面列表 ================= */
  function renderPageList() {
    var box = $("pageList");
    box.innerHTML = state.content.pages.map(function (p, i) {
      return '<div class="page-item' + (i === state.currentTabIndex ? " active" : "") + '" data-i="' + i + '">' +
        '<span>' + esc(p.icon || "📄") + "</span>" +
        '<span class="p-title">' + esc(p.title) + "<small>/" + esc(p.slug) + "</small></span>" +
        (p.hidden ? '<span class="hidden-tag">隐藏</span>' : "") +
        "</div>";
    }).join("");
    box.querySelectorAll(".page-item").forEach(function (el) {
      el.onclick = function () { selectPage(parseInt(el.dataset.i, 10)); };
    });
  }

  function selectPage(i) {
    state.currentTabIndex = i;
    state.expandedSection = -1;
    renderPageList();
    renderPageEditor();
  }

  $("btnAddPage").onclick = function () {
    var title = prompt("新页面名称：", "新页面");
    if (!title) return;
    var slug = (prompt("页面地址(英文/拼音，留空自动生成)：", "") || title).trim()
      .toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-").replace(/^-+|-+$/g, "") || uid();
    state.content.pages.push({
      id: uid(), title: title, slug: slug, icon: "📄", hidden: false,
      sections: [{ type: "hero", title: title, subtitle: "", desc: "在这里写页面的核心介绍。", buttons: [] }]
    });
    saveDraftLocal();
    selectPage(state.content.pages.length - 1);
  };

  /* ================= 页面编辑器 ================= */
  function currentPage() { return state.content.pages[state.currentTabIndex]; }

  function renderPageEditor() {
    var box = $("pageEditor");
    if (state.currentTabIndex == null || !currentPage()) {
      box.innerHTML = '<div class="panel"><p style="color:var(--text-light)">← 选择或新建一个页面开始编辑</p></div>';
      return;
    }
    var p = currentPage();
    var html = "";

    html += '<div class="panel"><h2>📄 页面信息</h2><div class="grid2">' +
      fieldInput("p_title", "页面名称（导航栏显示）", p.title) +
      fieldInput("p_slug", "地址标识（URL，建议英文）", p.slug) +
      fieldInput("p_icon", "图标（emoji，如 🎬）", p.icon || "") +
      '<div class="field"><label>是否在导航中隐藏</label><select id="p_hidden">' +
      '<option value="0"' + (p.hidden ? "" : " selected") + '>显示</option>' +
      '<option value="1"' + (p.hidden ? " selected" : "") + '>隐藏（仍可通过链接访问）</option></select></div>' +
      '</div><div class="actions-bar">' +
      '<button class="btn btn-outline btn-sm" id="pUp">⬆️ 上移</button>' +
      '<button class="btn btn-outline btn-sm" id="pDown">⬇️ 下移</button>' +
      '<button class="btn btn-danger btn-sm" id="pDel">🗑 删除此页面</button>' +
      "</div></div>";

    html += '<div class="panel"><h2>🧩 内容区块 <button class="btn btn-primary btn-sm" id="btnAddSection" style="margin-left:auto">＋ 添加区块</button></h2><div id="sectionList">';

    if (!p.sections.length) html += '<p style="color:var(--text-light)">暂无内容，点击「添加区块」开始创作</p>';

    p.sections.forEach(function (s, idx) {
      var def = SECTION_TYPES[s.type] || { icon: "❔", name: s.type };
      var titleText = s.title || s.text || s.q || (s.items && s.items.length ? (s.items.length + " 项") : "");
      html += '<div class="section-item"><div class="section-head" data-idx="' + idx + '">' +
        '<span class="s-type">' + def.icon + " " + esc(def.name) + "</span>" +
        '<span class="s-title">' + esc(titleText) + "</span>" +
        '<span class="s-ops">' +
        '<button data-op="up" data-idx="' + idx + '" title="上移">⬆️</button>' +
        '<button data-op="down" data-idx="' + idx + '" title="下移">⬇️</button>' +
        '<button data-op="del" data-idx="' + idx + '" title="删除">🗑</button>' +
        "</span></div>" +
        '<div class="section-body"' + (state.expandedSection === idx ? "" : ' style="display:none"') + ' id="secBody' + idx + '"></div></div>';
    });
    html += "</div></div>";

    box.innerHTML = html;

    /* 绑定页面信息 */
    bindLive("p_title", function (v) { p.title = v; saveDraftLocal(); renderPageList(); });
    bindLive("p_slug", function (v) { p.slug = v; saveDraftLocal(); renderPageList(); });
    bindLive("p_icon", function (v) { p.icon = v; saveDraftLocal(); renderPageList(); });
    $("p_hidden").onchange = function () { p.hidden = this.value === "1"; saveDraftLocal(); renderPageList(); };
    $("pUp").onclick = function () { moveItem(state.content.pages, state.currentTabIndex, -1, function (i) { state.currentTabIndex = i; renderPageList(); renderPageEditor(); }); };
    $("pDown").onclick = function () { moveItem(state.content.pages, state.currentTabIndex, 1, function (i) { state.currentTabIndex = i; renderPageList(); renderPageEditor(); }); };
    $("pDel").onclick = function () {
      if (confirm('确定删除页面「' + p.title + "」？此操作发布前可撤销（重置草稿）。")) {
        state.content.pages.splice(state.currentTabIndex, 1);
        state.currentTabIndex = null;
        saveDraftLocal(); renderPageList(); renderPageEditor();
      }
    };

    /* 绑定区块操作 */
    $("btnAddSection").onclick = function () { renderTypePicker(function (type) { addSection(type); }); };
    box.querySelectorAll(".section-head").forEach(function (head) {
      head.onclick = function (e) {
        if (e.target.closest("button[data-op]")) return;
        var idx = parseInt(head.dataset.idx, 10);
        state.expandedSection = (state.expandedSection === idx) ? -1 : idx;
        renderPageEditor();
      };
    });
    box.querySelectorAll("button[data-op]").forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.idx, 10), op = btn.dataset.op;
        if (op === "del") {
          if (!confirm("确定删除这个区块？")) return;
          p.sections.splice(idx, 1);
          state.expandedSection = -1;
          saveDraftLocal(); renderPageEditor();
        } else {
          moveItem(p.sections, idx, op === "up" ? -1 : 1, function () { renderPageEditor(); });
        }
      };
    });

    /* 渲染展开的区块编辑器 */
    if (state.expandedSection >= 0 && p.sections[state.expandedSection]) {
      renderSectionEditor($("secBody" + state.expandedSection), p.sections[state.expandedSection]);
    }
  }

  function addSection(type) {
    var p = currentPage();
    var s = { type: type };
    var def = SECTION_TYPES[type];
    def.fields.forEach(function (f) { s[f.k] = f.k === "title" ? "区块标题" : ""; });
    def.lists.forEach(function (l) { s[l.k] = []; });
    if (type === "article") { s.title = "文章标题"; s.html = "<p>在这里写正文…</p>"; }
    p.sections.push(s);
    state.expandedSection = p.sections.length - 1;
    saveDraftLocal();
    renderPageEditor();
  }

  function renderTypePicker(cb) {
    var html = '<div class="panel"><h2>➕ 选择区块类型</h2><div class="type-grid">';
    Object.keys(SECTION_TYPES).forEach(function (k) {
      var d = SECTION_TYPES[k];
      html += '<div class="type-card" data-t="' + k + '"><div class="t-icon">' + d.icon + '</div><div class="t-name">' +
        esc(d.name) + '</div><div class="t-desc">' + esc(d.desc) + "</div></div>";
    });
    html += "</div></div>";
    var box = $("pageEditor");
    var old = box.innerHTML;
    box.innerHTML = html + '<div class="actions-bar" style="margin-top:14px"><button class="btn btn-outline" id="cancelPick">取消</button></div>';
    box.querySelectorAll(".type-card").forEach(function (c) { c.onclick = function () { cb(c.dataset.t); }; });
    $("cancelPick").onclick = function () { box.innerHTML = old; renderPageEditor(); };
  }

  /* ================= 区块编辑器 ================= */
  function renderSectionEditor(container, s) {
    var def = SECTION_TYPES[s.type];
    var html = "";

    def.fields.forEach(function (f) {
      if (f.type === "htmlarea") {
        html += '<div class="field"><label>' + esc(f.l) + '</label><textarea class="html-area" data-k="' + f.k + '">' +
          esc(s[f.k] || "") + "</textarea>" + (f.hint ? '<div class="hint">' + f.hint + "</div>" : "") + "</div>";
      } else if (f.type === "textarea") {
        html += '<div class="field"><label>' + esc(f.l) + '</label><textarea data-k="' + f.k + '">' + esc(s[f.k] || "") + "</textarea></div>";
      } else {
        html += fieldInput("f_" + f.k, f.l, s[f.k] || "");
      }
    });

    def.lists.forEach(function (l) {
      html += '<div class="list-editor" data-list="' + l.k + '"><div class="le-title">' + esc(l.l) + "（" + (s[l.k] || []).length + "）</div>";
      (s[l.k] || []).forEach(function (item, i) {
        html += '<div class="le-row" data-i="' + i + '">';
        l.fields.forEach(function (f) {
          if (f.type === "textarea") {
            html += '<textarea data-ik="' + f.k + '" placeholder="' + esc(f.l) + '">' + esc(item[f.k] || "") + "</textarea>";
          } else if (f.media) {
            html += '<span class="media-row" style="flex:1;min-width:180px">' +
              '<input type="text" data-ik="' + f.k + '" placeholder="' + esc(f.l) + '" value="' + esc(item[f.k] || "") + '">' +
              '<button class="btn btn-outline btn-sm upload-btn" data-media="' + f.media + '" data-ik="' + f.k + '">📁上传</button></span>';
          } else {
            html += '<input type="text" data-ik="' + f.k + '" placeholder="' + esc(f.l) + '" value="' + esc(item[f.k] || "") + '">';
          }
        });
        html += '<button class="btn btn-danger btn-sm" data-del="' + i + '">✕</button></div>';
      });
      html += '<button class="btn btn-outline btn-sm" data-add="1">＋ 添加' + esc(l.itemLabel) + "</button></div>";
    });

    container.innerHTML = html;

    /* 绑定标量字段 */
    def.fields.forEach(function (f) {
      if (f.type === "htmlarea" || f.type === "textarea") {
        container.querySelector('[data-k="' + f.k + '"]').oninput = function () { s[f.k] = this.value; saveDraftLocal(); };
      } else {
        bindLive("f_" + f.k, function (v) { s[f.k] = v; saveDraftLocal(); });
      }
    });

    /* 绑定列表字段 */
    def.lists.forEach(function (l) {
      var box = container.querySelector('[data-list="' + l.k + '"]');
      box.querySelectorAll("[data-ik]").forEach(function (inp) {
        inp.oninput = function () {
          var i = parseInt(inp.closest(".le-row").dataset.i, 10);
          s[l.k][i][inp.dataset.ik] = this.value;
          saveDraftLocal();
        };
      });
      box.querySelectorAll("[data-del]").forEach(function (btn) {
        btn.onclick = function () { s[l.k].splice(parseInt(btn.dataset.del, 10), 1); saveDraftLocal(); renderPageEditor(); };
      });
      box.querySelector("[data-add]").onclick = function () {
        s[l.k].push(JSON.parse(JSON.stringify(l.tpl)));
        saveDraftLocal(); renderPageEditor();
      };
      /* 媒体上传按钮 */
      box.querySelectorAll("[data-media]").forEach(function (btn) {
        btn.onclick = function () { pickMedia(btn.dataset.media, function (url) { btn.parentElement.querySelector("input").value = url; btn.parentElement.querySelector("input").oninput(); }); };
      });
    });
  }

  /* ================= 媒体上传 ================= */
  var filePicker = $("filePicker");
  var pickCallback = null;

  function pickMedia(kind, cb) {
    var accept = kind === "image" ? "image/*" : kind === "video" ? "video/*" : "audio/*";
    filePicker.setAttribute("accept", accept);
    pickCallback = cb;
    filePicker.value = "";
    filePicker.click();
  }
  filePicker.onchange = function () {
    var file = this.files[0];
    if (!file || !pickCallback) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("文件超过 20MB，建议：大视频上传到B站/视频平台后粘贴嵌入链接；图片请压缩。");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var base64 = reader.result.split(",")[1];
      var gh = getGhConfig();
      if (gh.token && gh.owner && gh.repo) {
        /* 配置了GitHub：直接上传到仓库 media/ 目录，返回线上地址 */
        var path = "media/" + Date.now() + "-" + file.name.replace(/[^\w.-]/g, "_");
        log("正在上传媒体: " + path);
        ghPut(path, base64, "上传媒体 " + file.name).then(function () {
          var url = "https://" + gh.owner + ".github.io/" + gh.repo + "/" + path;
          log("媒体上传成功 → " + url);
          alert("✅ 上传成功！文件已提交到仓库。\n注意：GitHub Pages 生效需要几十秒到几分钟，期间预览可能显示空白，稍后刷新即可。");
          pickCallback(url);
        }).catch(function (err) {
          log("上传失败: " + err.message, "err");
          alert("上传失败：" + err.message + "\n可改用「保存本机预览」或手动导出。");
        });
      } else {
        /* 未配置GitHub：base64内联，本机预览可用 */
        if (file.size > 2 * 1024 * 1024) {
          alert("文件较大（" + (file.size / 1024 / 1024).toFixed(1) + "MB），内嵌会让 content.js 变得很重。\n建议先在「发布与备份」页配置GitHub后直接上传到仓库。已继续以内嵌方式保存（仅本机预览）。");
        }
        pickCallback(reader.result);
        log("媒体已内嵌保存（仅本机预览，发布时如文件过大建议改用仓库上传）", "warn");
      }
    };
    reader.readAsDataURL(file);
  };

  /* ================= 站点设置 ================= */
  function renderSiteSettings() {
    var c = state.content.site;
    $("siteSettings").innerHTML =
      fieldInput("s_title", "网站名称", c.title) +
      fieldInput("s_subtitle", "副标题", c.subtitle) +
      fieldInput("s_logo", "Logo图标(emoji)", c.logoText) +
      fieldInput("s_footer", "页脚文字", c.footer) +
      '<div class="field"><label>页脚副文本</label><input type="text" id="s_notice" value="' + esc(c.contact && c.contact.notice || "") + '"></div>' +
      '<div class="field"><label>联系微信</label><input type="text" id="s_wechat" value="' + esc(c.contact && c.contact.wechat || "") + '"></div>' +
      '<div class="field"><label>联系邮箱</label><input type="text" id="s_email" value="' + esc(c.contact && c.contact.email || "") + '"></div>';
    bindLive("s_title", function (v) { c.title = v; saveDraftLocal(); });
    bindLive("s_subtitle", function (v) { c.subtitle = v; saveDraftLocal(); });
    bindLive("s_logo", function (v) { c.logoText = v; saveDraftLocal(); });
    bindLive("s_footer", function (v) { c.footer = v; saveDraftLocal(); });
    bindLive("s_notice", function (v) { c.contact.notice = v; saveDraftLocal(); });
    bindLive("s_wechat", function (v) { c.contact.wechat = v; saveDraftLocal(); });
    bindLive("s_email", function (v) { c.contact.email = v; saveDraftLocal(); });
  }

  /* ================= 通用小工具 ================= */
  function fieldInput(id, label, val) {
    return '<div class="field"><label>' + esc(label) + '</label><input type="text" id="' + id + '" value="' + esc(val) + '"></div>';
  }
  function bindLive(id, cb) {
    var el = $(id);
    if (!el) return;
    el.oninput = function () { cb(this.value); };
  }
  function moveItem(arr, i, dir, after) {
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    saveDraftLocal();
    after(j);
  }

  /* ================= GitHub 发布 ================= */
  function getGhConfig() {
    try { return JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch (e) { return {}; }
  }
  ["ghOwner", "ghRepo", "ghBranch", "ghToken"].forEach(function (id) {
    $(id).oninput = saveGhConfig;
  });
  function saveGhConfig() {
    localStorage.setItem(GH_KEY, JSON.stringify({
      owner: $("ghOwner").value.trim(), repo: $("ghRepo").value.trim(),
      branch: ($("ghBranch").value.trim() || "main"), token: $("ghToken").value.trim()
    }));
  }
  function fillGhForm() {
    var gh = getGhConfig();
    $("ghOwner").value = gh.owner || "";
    $("ghRepo").value = gh.repo || "";
    $("ghBranch").value = gh.branch || "main";
    $("ghToken").value = gh.token || "";
  }
  $("btnSaveGh").onclick = function () { saveGhConfig(); log("GitHub 配置已保存（仅本机浏览器存储）"); alert("已保存。"); };
  $("btnTestGh").onclick = function () {
    var gh = getGhConfig();
    if (!gh.owner || !gh.repo || !gh.token) { alert("请先填写用户名、仓库名和 Token"); return; }
    log("测试连接 " + gh.owner + "/" + gh.repo + " ...");
    ghApi("GET", "/repos/" + gh.owner + "/" + gh.repo, null, gh).then(function (r) {
      log("✅ 连接成功：仓库 " + r.full_name + "（" + (r.private ? "私有" : "公开") + "）");
    }).catch(function (e) { log("❌ 连接失败: " + e.message, "err"); });
  };

  function ghApi(method, path, body, gh) {
    return fetch("https://api.github.com" + path, {
      method: method,
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "token " + gh.token
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (res.status === 404) throw new Error("文件或仓库不存在（检查仓库名/分支/Token权限）");
      if (res.status === 401) throw new Error("Token 无效或已过期");
      if (res.status === 409) throw new Error("更新冲突，请重试");
      if (!res.ok) throw new Error("GitHub API " + res.status);
      return res.json();
    });
  }

  function ghGetSha(path, gh) {
    return ghApi("GET", "/repos/" + gh.owner + "/" + gh.repo + "/contents/" + encodeURIComponent(path) + "?ref=" + gh.branch + "&t=" + Date.now(), null, gh)
      .then(function (r) { return r.sha; }).catch(function (e) { return null; });
  }

  function ghPut(path, base64, message) {
    var gh = getGhConfig();
    return ghGetSha(path, gh).then(function (sha) {
      return ghApi("PUT", "/repos/" + gh.owner + "/" + gh.repo + "/contents/" + path, {
        message: message, content: base64, sha: sha || undefined, branch: gh.branch
      }, gh);
    });
  }

  function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function doPublish() {
    var gh = getGhConfig();
    if (!gh.owner || !gh.repo || !gh.token) {
      alert("请先在「发布与备份」页填写 GitHub 配置（用户名 / 仓库名 / Token）");
      document.querySelector('.tab[data-tab="publish"]').click();
      return;
    }
    if (!confirm("将把当前草稿（content.js）提交到 " + gh.owner + "/" + gh.repo + "（" + gh.branch + " 分支）并自动更新网站。\n\n继续？")) return;

    log("开始发布…");
    var text = "/* 由内容管理后台生成 " + new Date().toISOString() + " */\n" +
      "window.SITE_CONTENT = " + JSON.stringify(state.content, null, 2) + ";\n";
    ghPut("content.js", toBase64(text), "更新网站内容 " + new Date().toLocaleString()).then(function () {
      log("✅ content.js 已提交！");
      log("GitHub Pages 一般在 1 分钟内自动更新，访问 https://" + gh.owner + ".github.io/" + gh.repo + " 查看效果。");
      state.dirty = false;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state.content));
      localStorage.removeItem(PREVIEW_KEY); /* 清除预览覆盖，以线上为准 */
      updateStatusBar();
      alert("🚀 发布成功！\n\n线上地址：https://" + gh.owner + ".github.io/" + gh.repo + "\n\nGitHub Pages 更新需1分钟左右，稍后刷新查看。");
    }).catch(function (e) {
      log("❌ 发布失败: " + e.message, "err");
      alert("发布失败：" + e.message);
    });
  }

  /* ================= 备份 ================= */
  $("btnExport").onclick = function () {
    var text = "window.SITE_CONTENT = " + JSON.stringify(state.content, null, 2) + ";\n";
    var blob = new Blob([text], { type: "text/javascript;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "content.js";
    a.click();
    log("已导出 content.js");
  };
  var mediaChangeHandler = filePicker.onchange;
  $("btnImport").onclick = function () {
    filePicker.setAttribute("accept", ".js,.json");
    filePicker.value = "";
    filePicker.onchange = function () {
      var f = this.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj;
          var txt = String(reader.result);
          var m = txt.match(/window\.SITE_CONTENT\s*=\s*([\s\S]*?);\s*$/);
          obj = m ? JSON.parse(m[1]) : JSON.parse(txt);
          if (!obj.pages || !obj.site) throw new Error("缺少 pages / site 字段");
          state.content = obj;
          state.currentTabIndex = null;
          saveDraftLocal();
          renderPageList(); renderPageEditor(); renderSiteSettings();
          log("导入成功：共 " + obj.pages.length + " 个页面");
        } catch (e) {
          alert("导入失败：文件不是有效的 content.js（" + e.message + "）");
        }
        filePicker.onchange = mediaChangeHandler; /* 恢复媒体上传逻辑 */
      };
      reader.readAsText(f);
    };
    filePicker.click();
  };
  $("btnReset").onclick = function () {
    if (!confirm("丢弃当前所有未发布的修改，恢复为仓库中已发布的 content.js 版本？")) return;
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(PREVIEW_KEY);
    state.content = loadDraft();
    state.currentTabIndex = null;
    renderPageList(); renderPageEditor(); renderSiteSettings();
    state.dirty = false;
    updateStatusBar();
    log("已重置为已发布版本");
  };

  /* ================= 初始化 ================= */
  state.content = loadDraft();
  renderPageList();
  renderPageEditor();
  renderSiteSettings();
  fillGhForm();
  updateStatusBar();

  window.addEventListener("beforeunload", function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ""; }
  });
})();
