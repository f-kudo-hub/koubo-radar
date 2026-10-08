// 公募レーダー 試験版：申込・確認・停止の画面の動き。受け口は Apps Script（config.js の KOUBO.gasUrl）。
// 送り方は「JSON を text/plain で POST」。text/plain ならブラウザの事前確認（プリフライト）が要らない。
(function () {
  'use strict';
  var cfg = window.KOUBO || {};

  function post(body) {
    return fetch(cfg.gasUrl, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        try { return JSON.parse(t); } catch (e) { return { ok: false, 理由: '受け口から読めない返事が来ました。時間をおいてもう一度お試しください' }; }
      });
  }
  function show(el, ok, text) {
    el.className = 'msg show ' + (ok ? 'ok' : 'ng');
    el.textContent = text;
  }
  function params() {
    var o = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      o[decodeURIComponent(kv.slice(0, i < 0 ? kv.length : i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
    });
    return o;
  }

  // ■ 申込（index.html）
  var form = document.getElementById('moushikomi-form');
  if (form) {
    var msg = document.getElementById('form-msg');
    var btn = form.querySelector('button[type=submit]');
    var all = form.querySelector('input[name=zenkoku]');
    var prefs = form.querySelectorAll('input[name=pref]');
    var regs = form.querySelectorAll('input[name=region]');

    function syncRegions() {
      regs.forEach(function (r) {
        var ps = form.querySelectorAll('input[name=pref][data-region="' + r.value + '"]');
        var on = 0; ps.forEach(function (p) { if (p.checked) on++; });
        r.checked = on === ps.length;
        r.indeterminate = on > 0 && on < ps.length;
      });
      var any = 0; prefs.forEach(function (p) { if (p.checked) any++; });
      all.checked = any === 0 || any === prefs.length;
    }
    all.addEventListener('change', function () {
      if (all.checked) prefs.forEach(function (p) { p.checked = false; });
      syncRegions();
    });
    regs.forEach(function (r) {
      r.addEventListener('change', function () {
        form.querySelectorAll('input[name=pref][data-region="' + r.value + '"]').forEach(function (p) { p.checked = r.checked; });
        syncRegions();
      });
    });
    prefs.forEach(function (p) { p.addEventListener('change', syncRegions); });

    // 見本のページの「この条件で試す」から来たときは、条件を入れておく
    var q = params();
    if (q.gyoshu) q.gyoshu.split(',').forEach(function (v) { var el = form.querySelector('input[name=gyoshu][value="' + v + '"]'); if (el) el.checked = true; });
    if (q.chiiki) q.chiiki.split(',').forEach(function (v) { var el = form.querySelector('input[name=pref][value="' + v + '"]'); if (el) el.checked = true; });
    syncRegions();

    if (!cfg.gasUrl) {
      btn.disabled = true;
      show(msg, false, 'ただいま受付の準備中です。もうしばらくお待ちください。');
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!cfg.gasUrl) return;
      var inds = []; form.querySelectorAll('input[name=gyoshu]:checked').forEach(function (x) { inds.push(x.value); });
      var ps = []; prefs.forEach(function (x) { if (x.checked) ps.push(x.value); });
      var company = form.kaisha.value.trim();
      var email = form.mail.value.trim();
      if (!company) { show(msg, false, '会社名を入れてください。'); form.kaisha.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { show(msg, false, 'メールアドレスの形を確かめてください。'); form.mail.focus(); return; }
      if (!inds.length) { show(msg, false, '業種を1つ以上選んでください。'); return; }
      if (!form.doui.checked) { show(msg, false, 'プライバシーポリシーへの同意にチェックを入れてください。'); return; }
      btn.disabled = true;
      var label = btn.querySelector('.label'); var orig = label.textContent; label.textContent = '送っています…';
      post({
        a: '申込', 会社名: company, メール: email, 業種: inds, 地域: all.checked ? [] : ps,
        国の機関: form.kuni.checked, 補助金: form.hojo.checked,
        除外語: form.jogai.value.split(/[,、，\s]+/).filter(Boolean), 罠: form.website.value,
      }).then(function (r) {
        if (r.ok) {
          show(msg, true, r.状態 === '確認のメールを送りました'
            ? '確認のメールを送りました。メールの中のURLを押すと、登録が完了します（迷惑メールのフォルダに入ることがあります）。'
            : r.状態);
          if (r.状態 === '確認のメールを送りました') form.reset(), syncRegions();
        } else {
          show(msg, false, r.理由 || '受け付けられませんでした。');
        }
      }).catch(function () {
        show(msg, false, '通信できませんでした。電波の良いところで、もう一度お試しください。');
      }).then(function () { btn.disabled = false; label.textContent = orig; });
    });
  }

  // ■ 登録の確認（kakunin.html）：開いたらすぐ確認する
  var kakunin = document.getElementById('kakunin');
  if (kakunin) {
    var p = params();
    var out = document.getElementById('kakunin-msg');
    if (!p.id || !p.t || !cfg.gasUrl) {
      show(out, false, 'このURLは使えません。メールのURLをそのまま開いてください。');
    } else {
      post({ a: '確認', id: p.id, t: p.t }).then(function (r) {
        if (r.ok) {
          show(out, true, (r.会社名 ? r.会社名 + ' さま　' : '') + (r.状態 === 'すでに登録されています' ? 'すでに登録されています。' : '登録が完了しました。次の平日の朝から便りが届きます。'));
          document.getElementById('kakunin-next').hidden = false;
        } else show(out, false, r.理由 || '確認できませんでした。');
      }).catch(function () { show(out, false, '通信できませんでした。もう一度開いてください。'); });
    }
  }

  // ■ 配信の停止（teishi.html）：押し間違い・メールの安全確認の機械が開いただけで止まらないよう、ボタンを押して止める
  var teishi = document.getElementById('teishi-form');
  if (teishi) {
    var tp = params();
    var tm = document.getElementById('teishi-msg');
    var tb = teishi.querySelector('button');
    if (!tp.id || !tp.t || !cfg.gasUrl) { tb.disabled = true; show(tm, false, 'このURLは使えません。便りに返信して、停止をお知らせください。'); }
    teishi.addEventListener('submit', function (ev) {
      ev.preventDefault();
      tb.disabled = true;
      post({ a: '停止', id: tp.id, t: tp.t }).then(function (r) {
        if (r.ok) { show(tm, true, r.状態 === 'すでに止まっています' ? 'すでに止まっています。' : '配信を止めました。これまでありがとうございました。'); tb.hidden = true; }
        else { show(tm, false, r.理由 || '止められませんでした。'); tb.disabled = false; }
      }).catch(function () { show(tm, false, '通信できませんでした。もう一度押してください。'); tb.disabled = false; });
    });
  }
})();
