/*
 * WebMCP для медальпобеда.рф (статический сайт без форм).
 * Регистрирует два read-only инструмента для браузерных ИИ-агентов:
 *   1) search_stories — поиск историй по ленте (index.html);
 *   2) get_participation_links — ссылки для участия с пометкой, какая бесплатная.
 * WebMCP — черновик стандарта: если браузер его не поддерживает,
 * скрипт молча ничего не делает и сайт работает как обычно.
 */
(function () {
  'use strict';

  var mc = (typeof document !== 'undefined' && document.modelContext) ||
           (typeof navigator !== 'undefined' && navigator.modelContext);
  if (!mc) return;

  function text(value) {
    return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] };
  }

  function loadIndexDocument() {
    if (/(^|\/)(index\.html)?$/.test(location.pathname)) {
      return Promise.resolve(document);
    }
    return fetch('index.html', { credentials: 'omit' })
      .then(function (r) { return r.text(); })
      .then(function (html) { return new DOMParser().parseFromString(html, 'text/html'); });
  }

  var searchStories = {
    name: 'search_stories',
    description: 'Поиск историй и выступлений на сайте Super Jump (медальпобеда.рф) по ключевым словам: имя спикера, тема, дата. Возвращает до 10 страниц со ссылкой и кратким описанием.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Слова для поиска, например «Довгань», «GO SMILE», «Академия 16 октября»' }
      },
      required: ['query']
    },
    annotations: { readOnlyHint: true },
    execute: function (input) {
      var words = String((input && input.query) || '').toLowerCase().split(/\s+/).filter(Boolean);
      return loadIndexDocument().then(function (doc) {
        var seen = {}, found = [];
        doc.querySelectorAll('a[href^="story-"]').forEach(function (a) {
          var href = a.getAttribute('href');
          if (seen[href]) return;
          var card = a.closest('div') || a.parentElement;
          var title = ((card.querySelector('h4, h3, h2') || {}).textContent || a.textContent || '').trim();
          var summary = ((card.querySelector('p') || {}).textContent || '').trim();
          var hay = (title + ' ' + summary + ' ' + href).toLowerCase();
          var ok = words.every(function (w) { return hay.indexOf(w) !== -1; });
          if (ok) {
            seen[href] = true;
            found.push({ title: title, summary: summary, url: new URL(href, location.href).href });
          }
        });
        return text(found.slice(0, 10).length ? found.slice(0, 10) : 'Ничего не найдено. Полный список страниц: ' + new URL('sitemap.xml', location.href).href);
      }).catch(function () {
        return text('Не удалось загрузить ленту историй. Полный список страниц: ' + new URL('sitemap.xml', location.href).href);
      });
    }
  };

  var participationLinks = {
    name: 'get_participation_links',
    description: 'Ссылки для участия в проектах Super Jump с пометками: что бесплатно, а что платно, и что ссылки партнёрские (реферальные).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: function () {
      return text({
        go_smile: {
          url: 'https://getgosmile.io/r/81982',
          description: 'GO SMILE — приложение-счётчик улыбок',
          free: true,
          referral_link: true
        },
        super_jump_registration: {
          url: 'https://account.superjump.com/register/81982',
          description: 'Регистрация в личном кабинете Super Jump. Далее в каталоге продуктов предлагается платный продукт «Купить клубный статус».',
          free: false,
          referral_link: true
        },
        morning_show: {
          url: 'https://vk.ru/it.super.jump',
          description: 'Шоу «Доброе утро» с Матвеем Харитоновым, ежедневно в 6:30 по Москве, ВКонтакте',
          free: true,
          referral_link: false
        }
      });
    }
  };

  [searchStories, participationLinks].forEach(function (tool) {
    try {
      if (typeof mc.registerTool === 'function') {
        var r = mc.registerTool(tool);
        if (r && typeof r.catch === 'function') r.catch(function () {});
      }
    } catch (e) { /* инструмент уже зарегистрирован или политика браузера запрещает */ }
  });

  if (typeof mc.registerTool !== 'function' && typeof mc.provideContext === 'function') {
    try { mc.provideContext({ tools: [searchStories, participationLinks] }); } catch (e) {}
  }
})();
