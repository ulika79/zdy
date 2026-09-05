/* ============================================================
   前台渲染引擎：读取 content.js（或 localStorage 覆盖内容），
   按 hash 路由渲染页面。所有页面/内容均可通过后台管理。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 内容获取：优先本地预览覆盖 ---------- */
  function getContent() {
    try {
      var local = localStorage.getItem("siteContentPreview");
      if (local) return JSON.parse(local);
    } catch (e) { /* ignore */ }
    return window.SITE_CONTENT;
  }

  var app = document.getElementById("app");
  var nav = document.getElementById("siteNav");

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isEmbedUrl(u) {
    return /^(https?:)?\/\/(www\.)?(youtube\.com|youtu\.be|bilibili\.com|player\.bilibili|vimeo\.com|douyin\.com)/i.test(u);
  }

  /* ---------- 区块渲染 ---------- */
  var renderers = {
    hero: function (s) {
      var btns = (s.buttons || []).map(function (b) {
        return '<a href="' + esc(b.url) + '">' + esc(b.text) + "</a>";
      }).join("");
      return '<section class="hero"><h1>' + esc(s.title) + "</h1>" +
        (s.subtitle ? '<div class="hero-sub">' + esc(s.subtitle) + "</div>" : "") +
        (s.desc ? '<p class="hero-desc">' + esc(s.desc) + "</p>" : "") +
        (btns ? '<div class="hero-btns">' + btns + "</div>" : "") + "</section>";
    },

    stats: function (s) {
      var items = (s.items || []).map(function (i) {
        return '<div class="stat-card"><div class="stat-num">' + esc(i.num) + '</div><div class="stat-label">' + esc(i.label) + "</div></div>";
      }).join("");
      return '<section class="section"><h2 class="section-title">' + esc(s.title) + "</h2>" +
        (s.subtitle ? '<p class="section-sub">' + esc(s.subtitle) + "</p>" : "") +
        '<div class="stats-grid">' + items + "</div></section>";
    },

    cards: function (s) {
      var items = (s.items || []).map(function (i) {
        return '<div class="card">' + (i.badge ? '<span class="badge">' + esc(i.badge) + "</span>" : "") +
          '<div class="card-icon">' + esc(i.icon || "✨") + "</div><h3>" + esc(i.title) + "</h3><p>" + esc(i.desc) + "</p></div>";
      }).join("");
      return '<section class="section"><h2 class="section-title">' + esc(s.title) + "</h2>" +
        (s.subtitle ? '<p class="section-sub">' + esc(s.subtitle) + "</p>" : "") +
        '<div class="cards-grid">' + items + "</div></section>";
    },

    article: function (s) {
      return '<section class="section"><h2 class="section-title">' + esc(s.title) + "</h2>" +
        (s.subtitle ? '<p class="section-sub">' + esc(s.subtitle) + "</p>" : "") +
        '<div class="article">' + (s.html || "") + "</div></section>";
    },

    steps: function (s) {
      var items = (s.items || []).map(function (i, idx) {
        return '<div class="step-item"><div class="step-num">' + (idx + 1) + "</div><div><h3>" +
          esc(i.title) + "</h3><p>" + esc(i.desc) + "</p></div></div>";
      }).join("");
      return '<section class="section"><h2 class="section-title">' + esc(s.title) + "</h2>" +
        (s.subtitle ? '<p class="section-sub">' + esc(s.subtitle) + "</p>" : "") +
        '<div class="steps-list">' + items + "</div></section>";
    },

    gallery: function (s) {
      var items = (s.items || []).map(function (i) {
        var media = i.src
          ? '<img src="' + esc(i.src) + '" alt="' + esc(i.caption || "") + '" loading="lazy">'
          : '<div class="media-placeholder">🖼️<small>图片位 · 后台可上传/替换</small></div>';
        return '<figure class="gallery-item">' + media + "<figcaption>" + esc(i.caption || "") + "</figcaption></figure>";
      }).join("");
      return '<section class="section"><h2 class="section-title">' + esc(s.title) + "</h2>" +
        (s.subtitle ? '<p class="section-sub">' + esc(s.subtitle) + "</p>" : "") +
        '<div class="gallery-grid">' + items + "</div></section>";
    },

    videos: function (s) {
      var items = (s.items || []).map(function (i) {
        var media;
        if (i.src && isEmbedUrl(i.src)) {
          media = '<iframe src="' + esc(i.src) + '" allowfullscreen loading="lazy"></iframe>';
        } else if (i.src) {
          media = '<video src="' + esc(i.src) + '" controls preload="metadata"' +
            (i.poster ? ' poster="' + esc(i.poster) + '"' : "") + "></video>";
        } else {
          media = '<div class="video-ph">🎬<small>视频位 · 后台可上传/替换</small></div>';
        }
        return '<figure class="video-item">' + media + "<figcaption>" + esc(i.caption || "") + "</figcaption></figure>";
      }).join("");
      return '<section class="section"><h2 class="section-title">' + esc(s.title) + "</h2>" +
        (s.subtitle ? '<p class="section-sub">' + esc(s.subtitle) + "</p>" : "") +
        '<div class="videos-grid">' + items + "</div></section>";
    },

    audio: function (s) {
      var items = (s.items || []).map(function (i) {
        var player = i.src
          ? '<audio src="' + esc(i.src) + '" controls preload="none"></audio>'
          : '<div class="audio-empty">🎧 音频位 · 在后台上传音频文件或填写外链</div>';
        return '<div class="audio-item"><div class="audio-head"><span class="audio-icon">🎧</span><strong>' +
          esc(i.title || "音频") + "</strong>" + (i.desc ? "<small>· " + esc(i.desc) + "</small>" : "") +
          "</div>" + player + "</div>";
      }).join("");
      return '<section class="section"><h2 class="section-title">' + esc(s.title) + "</h2>" +
        (s.subtitle ? '<p class="section-sub">' + esc(s.subtitle) + "</p>" : "") +
        '<div class="audio-list">' + items + "</div></section>";
    },

    pricing: function (s) {
      var items = (s.items || []).map(function (i) {
        var feats = String(i.features || "").split("\n").filter(Boolean).map(function (f) {
          return "<li>" + esc(f) + "</li>";
        }).join("");
        return '<div class="price-card' + (i.featured ? " featured" : "") + '"><div class="price-name">' + esc(i.name) +
          '</div><div class="price-num">' + esc(i.price) + '</div><div class="price-desc">' + esc(i.desc || "") +
          '</div><ul class="price-features">' + feats + "</ul></div>";
      }).join("");
      return '<section class="section"><h2 class="section-title">' + esc(s.title) + "</h2>" +
        (s.subtitle ? '<p class="section-sub">' + esc(s.subtitle) + "</p>" : "") +
        '<div class="pricing-grid">' + items + "</div></section>";
    },

    faq: function (s) {
      var items = (s.items || []).map(function (i) {
        return '<div class="faq-item"><button class="faq-q">' + esc(i.q) + '</button><div class="faq-a"><div class="faq-a-inner">' +
          esc(i.a) + "</div></div></div>";
      }).join("");
      return '<section class="section"><h2 class="section-title">' + esc(s.title) + "</h2>" +
        (s.subtitle ? '<p class="section-sub">' + esc(s.subtitle) + "</p>" : "") +
        '<div class="faq-list">' + items + "</div></section>";
    },

    cta: function (s) {
      var c = getContent().site.contact || {};
      var btns = (s.buttons || []).map(function (b) {
        return '<a href="' + esc(b.url) + '">' + esc(b.text) + "</a>";
      }).join("");
      var contact = "";
      if (c.wechat || c.email) {
        contact = '<div class="cta-contact">' +
          (c.wechat ? "<span>💬 微信：" + esc(c.wechat) + "</span>" : "") +
          (c.email ? "<span>📮 邮箱：" + esc(c.email) + "</span>" : "") + "</div>";
      }
      return '<section class="cta"><h2>' + esc(s.title) + "</h2><p>" + esc(s.desc || "") + "</p>" +
        (btns ? '<div class="hero-btns">' + btns + "</div>" : "") + contact + "</section>";
    }
  };

  /* ---------- 页面渲染 ---------- */
  function renderNav(pages, currentSlug) {
    nav.innerHTML = pages.filter(function (p) { return !p.hidden; }).map(function (p) {
      return '<a href="#/' + esc(p.slug) + '" class="' + (p.slug === currentSlug ? "active" : "") + '">' +
        (p.icon ? esc(p.icon) + " " : "") + esc(p.title) + "</a>";
    }).join("");
  }

  function renderPage() {
    var content = getContent();
    var pages = content.pages || [];
    var hash = location.hash.replace(/^#\/?/, "").split("?")[0];
    var page = pages.find(function (p) { return p.slug === hash; }) ||
               (!hash ? pages[0] : null);

    if (!page) {
      renderNav(pages, "");
      app.innerHTML = '<div class="not-found"><div class="big">🤔</div><h2>页面不存在</h2>' +
        '<p style="color:var(--text-light);margin:10px 0 20px">它可能被删除或改名了</p>' +
        '<a href="#/home" class="hero-btns" style="display:inline-block;padding:10px 26px;background:var(--primary);color:#fff;border-radius:999px;font-weight:700">返回首页</a></div>';
      return;
    }

    renderNav(pages, page.slug);
    document.title = page.title + " · " + (content.site.title || "");

    app.innerHTML = (page.sections || []).map(function (s) {
      return (renderers[s.type] || function () { return ""; })(s);
    }).join("");

    /* FAQ 折叠交互 */
    app.querySelectorAll(".faq-q").forEach(function (btn) {
      btn.addEventListener("click", function () {
        btn.parentElement.classList.toggle("open");
      });
    });
  }

  /* ---------- 站点信息 ---------- */
  function renderSiteMeta() {
    var c = getContent();
    document.getElementById("logoIcon").textContent = c.site.logoText || "🎬";
    document.getElementById("siteTitle").textContent = c.site.title || "我的网站";
    document.getElementById("footerText").textContent = c.site.footer || "";
    var fc = document.getElementById("footerContact");
    var ct = c.site.contact || {};
    fc.innerHTML = (ct.wechat ? "<span>💬 微信：" + esc(ct.wechat) + "</span>" : "") +
      (ct.email ? "<span>📮 邮箱：" + esc(ct.email) + "</span>" : "") +
      (ct.notice ? "<span>" + esc(ct.notice) + "</span>" : "");
  }

  /* ---------- 移动端菜单 ---------- */
  document.getElementById("navToggle").addEventListener("click", function () {
    nav.classList.toggle("open");
  });
  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") nav.classList.remove("open");
  });

  window.addEventListener("hashchange", function () {
    renderPage();
    window.scrollTo(0, 0);
  });

  renderSiteMeta();
  renderPage();
})();
