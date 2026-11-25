// Отправка заявки в обработчик api/lead.php.
// Если обработчика нет (страница открыта локально или на хостинге без PHP),
// форма работает как демо: показывает подтверждение и никуда ничего не шлёт.
window.Lead = (function () {
  const endpoint = new URL("../api/lead.php", document.currentScript.src).href;
  const openedAt = Date.now();

  // Демо без сервера: заявка сохраняется в этом браузере, и её видно в демо-кабинете (admin/)
  function keepDemo(data) {
    try {
      let list = [];
      try { list = JSON.parse(localStorage.getItem("demo-leads") || "[]"); } catch { /* битая запись — начинаем список заново */ }
      if (!Array.isArray(list)) list = [];
      list.unshift({ id: Date.now(), created_at: new Date().toISOString(), site: data.site, name: String(data.name || "").trim().slice(0, 60),
        phone: String(data.phone || "").trim().slice(0, 30), details: (data.details || []).slice(0, 25), comment: String(data.comment || "").slice(0, 500), status: "new", demo: true });
      localStorage.setItem("demo-leads", JSON.stringify(list.slice(0, 50)));
    } catch { /* приватный режим: просто не сохраняем */ }
    return { ok: true, demo: true };
  }

  async function send(data) {
    if (location.protocol === "file:") return keepDemo(data);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    let res;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, elapsed: Math.round((Date.now() - openedAt) / 1000) }),
        signal: ctrl.signal
      });
    } catch (e) {
      return { ok: false, error: e.name === "AbortError"
        ? "Сервер долго не отвечает. Попробуйте ещё раз через минуту или позвоните нам."
        : "Не получилось отправить: нет связи с сервером. Проверьте интернет или позвоните нам." };
    } finally {
      clearTimeout(timer);
    }
    if (!(res.headers.get("content-type") || "").includes("application/json")) {
      console.info("Обработчик заявок не найден (" + res.status + "), форма работает в демо-режиме.");
      return keepDemo(data);
    }
    let body = {};
    try { body = await res.json(); } catch { /* пустой ответ */ }
    if (res.ok && body.ok) return body;
    return { ok: false, error: body.error || "Сервер не принял заявку. Попробуйте ещё раз или позвоните нам." };
  }

  // Кнопка отправки: блокируем на время запроса и пишем, что происходит
  function busy(button, on, label) {
    if (on) { button.dataset.label = button.textContent; button.textContent = label || "Отправляем…"; button.disabled = true; button.setAttribute("aria-busy", "true"); }
    else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; button.removeAttribute("aria-busy"); }
  }

  return { send, busy };
})();
