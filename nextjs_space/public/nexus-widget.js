(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // NEXUS WIDGET v1.0.0
  // Self-contained — Shadow DOM — Zero dependencies
  // © Octopus Skills — octopuskills.com
  // ═══════════════════════════════════════════════════════════

  var API_BASE = 'https://octopuskills.com/api/nexus';
  var WIDGET_VERSION = '1.0.0';
  var STORAGE_KEY = 'nexus_anon_id';
  var SEEN_KEY = 'nexus_seen_session';

  // ── READ CONFIG FROM SCRIPT TAG ────────────────────────────
  function getConfig() {
    var script = document.currentScript ||
      document.querySelector('script[src*="nexus-widget"]');

    return {
      category:  script ? (script.getAttribute('data-category') || '') : '',
      limit:     script ? parseInt(script.getAttribute('data-limit') || '3', 10) : 3,
      position:  script ? (script.getAttribute('data-position') || 'bottom-right') : 'bottom-right',
      theme:     script ? (script.getAttribute('data-theme') || 'dark') : 'dark',
      context:   window.location.href,
      title:     script ? (script.getAttribute('data-title') || 'Discover Projects') : 'Discover Projects',
      delay:     script ? parseInt(script.getAttribute('data-delay') || '0', 10) : 0,
      autoOpen:  script ? (script.getAttribute('data-auto-open') === 'true') : false
    };
  }

  // ── ANONYMOUS ID (lightweight fingerprint) ─────────────────
  function getAnonymousId() {
    try {
      var id = localStorage.getItem(STORAGE_KEY);
      if (id) return id;

      var components = [
        navigator.language || '',
        navigator.platform || '',
        screen.width + 'x' + screen.height,
        screen.colorDepth || '',
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || '',
        navigator.maxTouchPoints || ''
      ].join('|');

      var hash = 5381;
      for (var i = 0; i < components.length; i++) {
        hash = ((hash << 5) + hash) + components.charCodeAt(i);
        hash = hash & hash;
      }

      var ts = Date.now().toString(36);
      var h = Math.abs(hash).toString(36);
      id = 'nxw-' + ts + '-' + h + '-' + Math.random().toString(36).slice(2, 8);

      localStorage.setItem(STORAGE_KEY, id);
      return id;
    } catch (e) {
      return 'nxw-' + Math.random().toString(36).slice(2, 18);
    }
  }

  // ── SESSION SEEN (client-side rate limiting) ───────────────
  function getSeenProjects() {
    try {
      return JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]');
    } catch (e) { return []; }
  }

  function markAsSeen(projectId) {
    try {
      var seen = getSeenProjects();
      if (seen.indexOf(projectId) === -1) {
        seen.push(projectId);
        sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen));
      }
    } catch (e) { /* silent */ }
  }

  // ── ANALYTICS ──────────────────────────────────────────────
  function trackEvent(eventType, project, anonymousId) {
    if (!project || !project.launchId) return;

    if (eventType === 'IMPRESSION') {
      var seen = getSeenProjects();
      if (seen.indexOf(project.id) !== -1) return;
      markAsSeen(project.id);
    }

    var payload = {
      launchId: project.launchId,
      projectId: project.id,
      anonymousId: anonymousId,
      eventType: eventType,
      contextUrl: window.location.href
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        API_BASE + '/events',
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      );
    } else {
      fetch(API_BASE + '/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    }
  }

  // ── FETCH PROJECTS ─────────────────────────────────────────
  function fetchProjects(config) {
    var params = new URLSearchParams();
    if (config.category) params.set('category', config.category);
    params.set('limit', String(Math.min(config.limit, 10)));
    params.set('context', config.context);

    return fetch(API_BASE + '/widget?' + params.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
    .then(function (res) {
      if (!res.ok) throw new Error('Widget fetch failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      return data.projects || [];
    });
  }

  // ── RESOLVE THEME ──────────────────────────────────────────
  function resolveTheme(theme) {
    if (theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }

  // ── COLOR PALETTES ─────────────────────────────────────────
  function getColors(theme) {
    var isDark = resolveTheme(theme) === 'dark';

    return isDark ? {
      bg:          '#0D0D1F',
      bgCard:      '#13132A',
      bgHover:     '#1a1a35',
      text:        '#F6FCFF',
      muted:       'rgba(246,252,255,0.60)',
      accent:      '#6C63FF',
      accentGlow:  'rgba(108,99,255,0.25)',
      success:     '#00D4AA',
      border:      'rgba(255,255,255,0.08)',
      borderHover: 'rgba(108,99,255,0.4)',
      shadow:      '0 24px 64px rgba(0,0,0,0.6)',
      fabBg:       '#6C63FF',
      fabText:     '#ffffff',
      closeHover:  'rgba(255,255,255,0.1)',
      badgeBg:     'rgba(108,99,255,0.15)',
      badgeText:   '#6C63FF'
    } : {
      bg:          '#FFFFFF',
      bgCard:      '#F8F8FF',
      bgHover:     '#F0F0FF',
      text:        '#0D0D2B',
      muted:       'rgba(13,13,43,0.55)',
      accent:      '#6C63FF',
      accentGlow:  'rgba(108,99,255,0.15)',
      success:     '#00B894',
      border:      'rgba(0,0,0,0.08)',
      borderHover: 'rgba(108,99,255,0.4)',
      shadow:      '0 24px 64px rgba(0,0,0,0.15)',
      fabBg:       '#6C63FF',
      fabText:     '#ffffff',
      closeHover:  'rgba(0,0,0,0.06)',
      badgeBg:     'rgba(108,99,255,0.10)',
      badgeText:   '#6C63FF'
    };
  }

  // ── BUILD STYLES ───────────────────────────────────────────
  function buildStyles(theme, position) {
    var c = getColors(theme);
    var posRight = position.indexOf('right') !== -1;
    var posBottom = position.indexOf('bottom') !== -1;
    var isSidebar = position.indexOf('sidebar') !== -1;

    var panelWidth = isSidebar ? '320px' : '340px';
    var panelMaxH = isSidebar ? '100vh' : '520px';
    var panelRadius = isSidebar
      ? (posRight ? '16px 0 0 16px' : '0 16px 16px 0')
      : '20px';

    return '\n'
    + ':host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.5; }\n'
    + '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n'

    // FAB
    + '.nxw-fab {'
    + '  position: fixed;'
    + (posRight ? '  right: 20px;' : '  left: 20px;')
    + (posBottom ? '  bottom: 20px;' : '  top: 20px;')
    + '  z-index: 2147483646;'
    + '  display: flex; align-items: center; gap: 8px;'
    + '  padding: 12px 20px;'
    + '  background: ' + c.fabBg + ';'
    + '  color: ' + c.fabText + ';'
    + '  border: none; border-radius: 9999px;'
    + '  font-size: 14px; font-weight: 600;'
    + '  cursor: pointer;'
    + '  box-shadow: 0 4px 24px ' + c.accentGlow + ', 0 2px 8px rgba(0,0,0,0.2);'
    + '  transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);'
    + '  user-select: none; letter-spacing: -0.01em;'
    + '  font-family: inherit;'
    + '}\n'
    + '.nxw-fab:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 8px 32px ' + c.accentGlow + ', 0 4px 12px rgba(0,0,0,0.25); }\n'
    + '.nxw-fab:active { transform: translateY(0) scale(0.97); }\n'
    + '.nxw-fab.hidden { opacity: 0; pointer-events: none; transform: scale(0.8); }\n'
    + '.nxw-fab-icon { font-size: 18px; line-height: 1; }\n'
    + '.nxw-fab-badge { background: rgba(255,255,255,0.25); border-radius: 9999px; padding: 2px 7px; font-size: 11px; font-weight: 700; }\n'

    // PANEL
    + '.nxw-panel {'
    + '  position: fixed;'
    + (posRight ? '  right: 20px;' : '  left: 20px;')
    + (posBottom && !isSidebar ? '  bottom: 80px;' : '')
    + (!posBottom && !isSidebar ? '  top: 80px;' : '')
    + (isSidebar ? '  top: 0; bottom: 0;' : '')
    + '  width: ' + panelWidth + '; max-height: ' + panelMaxH + ';'
    + '  z-index: 2147483647;'
    + '  background: ' + c.bg + ';'
    + '  border: 1px solid ' + c.border + ';'
    + '  border-radius: ' + panelRadius + ';'
    + '  box-shadow: ' + c.shadow + ';'
    + '  display: flex; flex-direction: column; overflow: hidden;'
    + '  opacity: 0; transform: translateY(12px) scale(0.97);'
    + '  pointer-events: none;'
    + '  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);'
    + '}\n'
    + '.nxw-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }\n'

    // HEADER
    + '.nxw-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid ' + c.border + '; flex-shrink: 0; }\n'
    + '.nxw-header-left { display: flex; align-items: center; gap: 10px; }\n'
    + '.nxw-logo { font-size: 15px; font-weight: 800; color: ' + c.accent + '; letter-spacing: -0.02em; }\n'
    + '.nxw-title { font-size: 13px; font-weight: 500; color: ' + c.muted + '; }\n'
    + '.nxw-close { width: 28px; height: 28px; border-radius: 8px; border: none; background: transparent; color: ' + c.muted + '; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s; flex-shrink: 0; font-family: inherit; }\n'
    + '.nxw-close:hover { background: ' + c.closeHover + '; color: ' + c.text + '; }\n'

    // LIST
    + '.nxw-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; scrollbar-width: thin; scrollbar-color: ' + c.border + ' transparent; }\n'
    + '.nxw-list::-webkit-scrollbar { width: 4px; }\n'
    + '.nxw-list::-webkit-scrollbar-track { background: transparent; }\n'
    + '.nxw-list::-webkit-scrollbar-thumb { background: ' + c.border + '; border-radius: 2px; }\n'

    // CARD
    + '.nxw-card { display: flex; gap: 12px; padding: 14px; background: ' + c.bgCard + '; border: 1px solid ' + c.border + '; border-radius: 14px; cursor: pointer; transition: all 0.22s cubic-bezier(0.4,0,0.2,1); text-decoration: none; align-items: flex-start; opacity: 0; transform: translateY(8px); }\n'
    + '.nxw-card.visible { opacity: 1; transform: translateY(0); }\n'
    + '.nxw-card:hover { background: ' + c.bgHover + '; border-color: ' + c.borderHover + '; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(108,99,255,0.12); }\n'
    + '.nxw-card:active { transform: translateY(0); }\n'

    // CARD IMAGE
    + '.nxw-img { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: ' + c.border + '; }\n'
    + '.nxw-img-placeholder { width: 48px; height: 48px; border-radius: 10px; background: linear-gradient(135deg, ' + c.accent + '33, ' + c.success + '33); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }\n'

    // CARD BODY
    + '.nxw-body { flex: 1; min-width: 0; }\n'
    + '.nxw-badge { display: inline-block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: ' + c.badgeText + '; background: ' + c.badgeBg + '; padding: 2px 8px; border-radius: 9999px; margin-bottom: 5px; }\n'
    + '.nxw-name { font-size: 13px; font-weight: 600; color: ' + c.text + '; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n'
    + '.nxw-desc { font-size: 12px; color: ' + c.muted + '; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n'

    // VISIT BUTTON
    + '.nxw-visit { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 5px 12px; background: ' + c.accent + '; color: #fff; border-radius: 9999px; font-size: 11px; font-weight: 600; text-decoration: none; transition: opacity 0.2s; border: none; cursor: pointer; font-family: inherit; }\n'
    + '.nxw-visit:hover { opacity: 0.85; }\n'

    // FOOTER
    + '.nxw-footer { display: flex; align-items: center; justify-content: center; padding: 10px; border-top: 1px solid ' + c.border + '; flex-shrink: 0; }\n'
    + '.nxw-powered { font-size: 10px; color: ' + c.muted + '; text-decoration: none; opacity: 0.7; transition: opacity 0.2s; }\n'
    + '.nxw-powered:hover { opacity: 1; }\n'

    // EMPTY STATE
    + '.nxw-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; gap: 8px; }\n'
    + '.nxw-empty-icon { font-size: 36px; }\n'
    + '.nxw-empty-text { font-size: 13px; color: ' + c.muted + '; line-height: 1.6; }\n'

    // LOADING
    + '.nxw-loading { display: flex; align-items: center; justify-content: center; padding: 40px; gap: 6px; }\n'
    + '.nxw-dot { width: 7px; height: 7px; background: ' + c.accent + '; border-radius: 50%; animation: nxwPulse 1.2s ease-in-out infinite; }\n'
    + '.nxw-dot:nth-child(2) { animation-delay: 0.2s; }\n'
    + '.nxw-dot:nth-child(3) { animation-delay: 0.4s; }\n'

    // ANIMATIONS
    + '@keyframes nxwPulse { 0%,80%,100% { opacity: 0.2; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }\n'

    // RESPONSIVE
    + '@media (max-width: 400px) {'
    + '  .nxw-panel { left: 8px !important; right: 8px !important; width: auto !important; max-height: 70vh !important; border-radius: 16px !important; }'
    + '  .nxw-fab { padding: 10px 16px; font-size: 13px; }'
    + '}\n';
  }

  // ── BUILD CARD HTML ────────────────────────────────────────
  function buildCard(project) {
    var card = document.createElement('div');
    card.className = 'nxw-card';
    card.setAttribute('data-id', project.id);

    // Image or placeholder
    if (project.imageUrl) {
      var img = document.createElement('img');
      img.className = 'nxw-img';
      img.src = project.imageUrl;
      img.alt = project.name;
      img.loading = 'lazy';
      img.onerror = function () {
        var ph = document.createElement('div');
        ph.className = 'nxw-img-placeholder';
        ph.textContent = project.name.charAt(0).toUpperCase();
        card.replaceChild(ph, img);
      };
      card.appendChild(img);
    } else {
      var placeholder = document.createElement('div');
      placeholder.className = 'nxw-img-placeholder';
      placeholder.textContent = project.name.charAt(0).toUpperCase();
      card.appendChild(placeholder);
    }

    // Body
    var body = document.createElement('div');
    body.className = 'nxw-body';

    if (project.category) {
      var badge = document.createElement('div');
      badge.className = 'nxw-badge';
      badge.textContent = project.category;
      body.appendChild(badge);
    }

    var name = document.createElement('div');
    name.className = 'nxw-name';
    name.textContent = project.name;
    body.appendChild(name);

    if (project.description) {
      var desc = document.createElement('div');
      desc.className = 'nxw-desc';
      desc.textContent = project.description;
      body.appendChild(desc);
    }

    var visitBtn = document.createElement('a');
    visitBtn.className = 'nxw-visit';
    visitBtn.href = project.url || '#';
    visitBtn.target = '_blank';
    visitBtn.rel = 'noopener noreferrer';
    visitBtn.textContent = 'Visit \u2192';
    body.appendChild(visitBtn);

    card.appendChild(body);
    return card;
  }

  // ── MAIN WIDGET CLASS ──────────────────────────────────────
  function NexusWidgetCore(config) {
    this.config = config;
    this.anonymousId = getAnonymousId();
    this.projects = [];
    this.isOpen = false;
    this.host = null;
    this.shadow = null;
    this.fab = null;
    this.panel = null;
    this.destroyed = false;
  }

  NexusWidgetCore.prototype.init = function () {
    var self = this;

    // Create host element
    this.host = document.createElement('div');
    this.host.id = 'nexus-widget-host';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    // Inject styles
    var style = document.createElement('style');
    style.textContent = buildStyles(this.config.theme, this.config.position);
    this.shadow.appendChild(style);

    // Build FAB
    this.fab = document.createElement('button');
    this.fab.className = 'nxw-fab';
    this.fab.innerHTML = '<span class="nxw-fab-icon">\uD83D\uDC19</span> Nexus <span class="nxw-fab-badge">...</span>';
    this.fab.addEventListener('click', function () { self.toggle(); });
    this.shadow.appendChild(this.fab);

    // Build Panel
    this.panel = document.createElement('div');
    this.panel.className = 'nxw-panel';

    // Panel header
    var header = document.createElement('div');
    header.className = 'nxw-header';

    var headerLeft = document.createElement('div');
    headerLeft.className = 'nxw-header-left';
    headerLeft.innerHTML = '<span class="nxw-logo">\uD83D\uDC19 Nexus</span><span class="nxw-title">' + this.escapeHtml(this.config.title) + '</span>';
    header.appendChild(headerLeft);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'nxw-close';
    closeBtn.innerHTML = '\u2715';
    closeBtn.addEventListener('click', function () { self.close(); });
    header.appendChild(closeBtn);

    this.panel.appendChild(header);

    // Card list
    this.listEl = document.createElement('div');
    this.listEl.className = 'nxw-list';
    this.listEl.innerHTML = '<div class="nxw-loading"><div class="nxw-dot"></div><div class="nxw-dot"></div><div class="nxw-dot"></div></div>';
    this.panel.appendChild(this.listEl);

    // Footer
    var footer = document.createElement('div');
    footer.className = 'nxw-footer';
    var powered = document.createElement('a');
    powered.className = 'nxw-powered';
    powered.href = 'https://octopuskills.com';
    powered.target = '_blank';
    powered.rel = 'noopener';
    powered.textContent = '\uD83D\uDC19 Powered by Octopus Nexus';
    footer.appendChild(powered);
    this.panel.appendChild(footer);

    this.shadow.appendChild(this.panel);
    document.body.appendChild(this.host);

    // Prefetch projects
    this.prefetch();

    // Click outside to close
    document.addEventListener('click', function (e) {
      if (self.isOpen && self.host && !self.host.contains(e.target)) {
        self.close();
      }
    });

    // Auto-open with delay
    if (this.config.autoOpen) {
      setTimeout(function () {
        if (!self.destroyed) self.open();
      }, Math.max(this.config.delay, 500));
    }
  };

  NexusWidgetCore.prototype.escapeHtml = function (str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  };

  NexusWidgetCore.prototype.prefetch = function () {
    var self = this;
    fetchProjects(this.config)
      .then(function (projects) {
        self.projects = projects;
        var badgeEl = self.fab.querySelector('.nxw-fab-badge');
        if (badgeEl) badgeEl.textContent = String(projects.length);
      })
      .catch(function (err) {
        console.warn('[Nexus Widget] Prefetch failed:', err.message);
        var badgeEl = self.fab.querySelector('.nxw-fab-badge');
        if (badgeEl) badgeEl.textContent = '!';
      });
  };

  NexusWidgetCore.prototype.renderProjects = function () {
    var self = this;
    this.listEl.innerHTML = '';

    if (!this.projects || this.projects.length === 0) {
      this.listEl.innerHTML = '<div class="nxw-empty">'
        + '<div class="nxw-empty-icon">\uD83D\uDD2D</div>'
        + '<div class="nxw-empty-text">No projects found right now.<br>Check back later!</div>'
        + '</div>';
      return;
    }

    this.projects.forEach(function (project, index) {
      var card = buildCard(project);

      // Track IMPRESSION with stagger
      setTimeout(function () {
        card.classList.add('visible');
        trackEvent('IMPRESSION', project, self.anonymousId);
      }, 80 * (index + 1));

      // Track CLICK on card or visit button
      card.addEventListener('click', function (e) {
        var target = e.target;
        // If they clicked the visit <a>, let it navigate naturally
        if (target.tagName === 'A' && target.classList.contains('nxw-visit')) {
          trackEvent('CLICK', project, self.anonymousId);
          return;
        }
        // Otherwise click anywhere on card
        e.preventDefault();
        trackEvent('CLICK', project, self.anonymousId);
        if (project.url) {
          window.open(project.url, '_blank', 'noopener,noreferrer');
        }
      });

      self.listEl.appendChild(card);
    });
  };

  NexusWidgetCore.prototype.open = function () {
    if (this.isOpen || this.destroyed) return;
    this.isOpen = true;
    this.fab.classList.add('hidden');
    this.panel.classList.add('open');
    this.renderProjects();
  };

  NexusWidgetCore.prototype.close = function () {
    if (!this.isOpen || this.destroyed) return;
    this.isOpen = false;
    this.panel.classList.remove('open');
    this.fab.classList.remove('hidden');

    // Track DISMISS for all visible projects
    var self = this;
    this.projects.forEach(function (p) {
      trackEvent('DISMISS', p, self.anonymousId);
    });
  };

  NexusWidgetCore.prototype.toggle = function () {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  };

  NexusWidgetCore.prototype.refresh = function () {
    var self = this;
    this.listEl.innerHTML = '<div class="nxw-loading"><div class="nxw-dot"></div><div class="nxw-dot"></div><div class="nxw-dot"></div></div>';
    fetchProjects(this.config)
      .then(function (projects) {
        self.projects = projects;
        var badgeEl = self.fab.querySelector('.nxw-fab-badge');
        if (badgeEl) badgeEl.textContent = String(projects.length);
        if (self.isOpen) self.renderProjects();
      })
      .catch(function () {
        self.listEl.innerHTML = '<div class="nxw-empty">'
          + '<div class="nxw-empty-icon">\u26A0\uFE0F</div>'
          + '<div class="nxw-empty-text">Could not load projects.<br>Please try again.</div>'
          + '</div>';
      });
  };

  NexusWidgetCore.prototype.setCategory = function (category) {
    this.config.category = category || '';
    this.refresh();
  };

  NexusWidgetCore.prototype.getProjects = function () {
    return this.projects.slice();
  };

  NexusWidgetCore.prototype.destroy = function () {
    this.destroyed = true;
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
    this.projects = [];
    delete window.NexusWidget;
  };

  // ── INITIALIZATION ─────────────────────────────────────────
  function bootstrap() {
    var config = getConfig();
    var widget = new NexusWidgetCore(config);
    widget.init();

    // Expose public API
    window.NexusWidget = {
      version: WIDGET_VERSION,
      open:         function () { widget.open(); },
      close:        function () { widget.close(); },
      toggle:       function () { widget.toggle(); },
      refresh:      function () { widget.refresh(); },
      setCategory:  function (cat) { widget.setCategory(cat); },
      getProjects:  function () { return widget.getProjects(); },
      destroy:      function () { widget.destroy(); }
    };
  }

  // Use requestIdleCallback to avoid blocking the host site
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(bootstrap);
    } else {
      setTimeout(bootstrap, 100);
    }
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(bootstrap);
      } else {
        setTimeout(bootstrap, 100);
      }
    });
  }

})();
