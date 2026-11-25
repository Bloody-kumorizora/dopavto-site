// Страница: выбор услуги (чипы + панель), связь с 3D-машиной и форма заявки.
(function () {
  const S = window.SERVICES, P = window.SERVICE_PRICE;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let current = null;

  // ---------- чипы над машиной
  const chips = $("chips");
  chips.innerHTML = S.map((s, i) => `<button class="chip" type="button" data-id="${s.id}" aria-pressed="false" style="--i:${i}">${esc(s.chip)}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    select(b.dataset.id === current ? null : b.dataset.id);
  });

  function panelHTML(s) {
    if (!s) return `<p class="panel-kicker">Выберите, что поставить</p>
      <h2>Нажмите на услугу и посмотрите на машине</h2>
      <p class="what">Покажу, где встаёт оборудование и что изменится. Машину можно крутить пальцем или мышкой.</p>
      <div class="price"><b>${esc(P.text)}</b><span>${esc(P.note)}</span></div>
      <a class="btn btn-amber" href="#ask">Узнать цену для моей машины</a>`;
    return `<p class="panel-kicker">Так будет после установки</p>
      <h2>${esc(s.title)}</h2>
      <p class="what">${esc(s.what)}</p>
      <ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      <div class="price"><b>${esc(P.text)}</b><span>${esc(P.note)}</span></div>
      <a class="btn btn-amber" href="#ask" data-ask="${s.id}">Узнать цену для моей машины</a>`;
  }

  const body = $("panelBody");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function select(id) {
    current = id;
    chips.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
    const s = S.find((x) => x.id === id) || null;
    if (reduce) body.innerHTML = panelHTML(s);
    else { body.classList.add("swap"); setTimeout(() => { body.innerHTML = panelHTML(s); body.classList.remove("swap"); }, 160); }
    document.querySelector(".panel")?.classList.toggle("lit", !!s);
    document.querySelector(".stage")?.classList.toggle("inside", id === "android");
    document.querySelector(".stage")?.classList.toggle("svc-on", !!s);
    window.dispatchEvent(new CustomEvent("svc:select", { detail: s }));
    if (id) { const chip = chips.querySelector(`[data-id="${id}"]`); chip && chip.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" }); }
  }
  body.innerHTML = panelHTML(null);
  // когда кнопки доиграли появление — фиксируем их, чтобы повторно не мигали
  // кнопки услуг появляются, когда машина доехала и остановилась (до этого выбрать услугу нельзя)
  const markReady = () => chips.classList.add("ready");
  window.addEventListener("car:arrived", () => {
    chips.classList.add("show"); chips.removeAttribute("aria-hidden");
    chips.querySelectorAll(".chip").forEach((b) => (b.disabled = false));
    setTimeout(markReady, S.length * 45 + 700);
  }, { once: true });
  chips.setAttribute("aria-hidden", "true"); chips.querySelectorAll(".chip").forEach((b) => (b.disabled = true));
  setTimeout(() => { if (!chips.classList.contains("show")) window.dispatchEvent(new Event("car:arrived")); }, 12000);   // страховка, если 3D не загрузилось
  // клик по детали на машине тоже выбирает услугу
  window.addEventListener("car:pick", (e) => select(e.detail));
  window.addEventListener("car:ready", () => { const first = new URLSearchParams(location.search).get("s"); if (first && S.some((x) => x.id === first)) select(first); });

  // ---------- форма
  const pick = $("fPick");
  pick.innerHTML = S.map((s) => `<button type="button" data-id="${s.id}" aria-pressed="false">${esc(s.chip)}</button>`).join("")
    + `<button type="button" data-id="other" aria-pressed="false">Другое</button>`;
  pick.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-ask]"); if (!a) return;
    const b = pick.querySelector(`[data-id="${a.dataset.ask}"]`); b && b.setAttribute("aria-pressed", "true");
  });

  // ---------- шапка прячется при прокрутке вниз
  const top = document.querySelector(".top"), stage = document.querySelector(".stage"); let lastY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY; top.classList.toggle("hide", y > lastY && y > 160); lastY = y;
    top.classList.toggle("solid", y > stage.offsetHeight - 80);   // над светлыми блоками шапка плотная
  }, { passive: true });
  top.addEventListener("focusin", () => top.classList.remove("hide"));

  // ---------- фото и шаги проявляются один раз, когда доезжают до экрана
  document.querySelectorAll(".works figure").forEach((f, i) => f.style.setProperty("--i", i));
  document.querySelectorAll(".steps li").forEach((li, i) => li.style.setProperty("--i", i));
  // следим за контейнерами: у фото под «шторкой» нет видимой площади, их самих наблюдать нельзя
  const io = new IntersectionObserver((list) => list.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in"); e.target.querySelectorAll("figure").forEach((f) => f.classList.add("in"));
    io.unobserve(e.target);
  }), { threshold: 0.1 });
  document.querySelectorAll(".works, .steps").forEach((el) => io.observe(el));

  // ---------- появление блоков при прокрутке: заголовки, тексты, карточки, форма, контакты
  const groups = [
    ["#works .section-head h2, #how .section-head h2, #askH, #contactsH", "rv rv-head"],
    ["#works .section-head p, .ask-grid > div:first-child > p", "rv"],
    [".also", "rv"], [".trust li", "rv"], ["#askForm", "rv"], [".contacts-grid > div", "rv"], ["#callBtn", "rv"],
  ];
  // у заголовка под «шторкой» нет видимой площади — следим за его родителем и проявляем заголовок через него
  const watch = new Map();
  const rvio = new IntersectionObserver((list) => list.forEach((e) => {
    if (!e.isIntersecting) return;
    (watch.get(e.target) || []).forEach((el) => el.classList.add("in")); rvio.unobserve(e.target);
  }), { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
  for (const [sel, cls] of groups) document.querySelectorAll(sel).forEach((el, i) => {
    el.className += " " + cls; el.style.setProperty("--i", i);
    const target = cls.includes("rv-head") ? el.parentElement : el;
    if (!watch.has(target)) { watch.set(target, []); rvio.observe(target); }
    watch.get(target).push(el);
  });

  // ---------- примеры работ: фото открывается крупно, листается стрелками, клавишами и свайпом
  const shots = [...document.querySelectorAll(".works figure")];
  const lb = $("lightbox"); let cur = 0;
  function show(i) {
    cur = (i + shots.length) % shots.length;
    const f = shots[cur], img = f.querySelector("img");
    $("lbImg").src = img.src; $("lbImg").alt = img.alt;
    $("lbTitle").textContent = f.querySelector("figcaption b")?.textContent || "";
    $("lbText").textContent = f.querySelector("figcaption")?.childNodes[1]?.textContent?.trim() || "";
    $("lbCount").textContent = `${cur + 1} из ${shots.length}`;
  }
  shots.forEach((f, i) => {
    f.tabIndex = 0; f.setAttribute("role", "button"); f.setAttribute("aria-label", "Открыть фото: " + f.querySelector("img").alt);
    const open = () => { show(i); lb.showModal(); document.documentElement.classList.add("lb-open"); };
    f.addEventListener("click", open);
    f.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  const close = () => lb.close();
  lb.addEventListener("close", () => { document.documentElement.classList.remove("lb-open"); shots[cur]?.focus(); });
  $("lbClose").addEventListener("click", close);
  $("lbPrev").addEventListener("click", () => show(cur - 1));
  $("lbNext").addEventListener("click", () => show(cur + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });   // клик по затемнению — закрыть
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
  let sx = null;
  lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); sx = null; });

  $("askForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const car = $("fCar").value.trim(), phone = $("fPhone").value.trim(), name = $("fName").value.trim();
    const digits = phone.replace(/\D/g, "");
    let msg = "";
    if (!car) { msg = "Напишите марку и модель, чтобы я мог подобрать оборудование."; $("fCar").focus(); }
    else if (digits.length < 10) { msg = "Проверьте телефон: в номере должно быть 10–11 цифр."; $("fPhone").focus(); }
    else if (!$("fConsent").checked) { msg = "Отметьте согласие на обработку имени и телефона, без него заявку не принять."; $("fConsent").focus(); }
    $("fErr").textContent = msg; if (msg) return;
    const chosen = [...pick.querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent);
    const btn = $("fSend");
    Lead.busy(btn, true, "Отправляем…");
    const res = await Lead.send({
      site: "dopavto", name, phone, consent: true, website: $("fHp").value,
      details: [`Машина: ${car}${$("fYear").value ? ", " + $("fYear").value.trim() : ""}`, ...(chosen.length ? ["Поставить: " + chosen.join(", ")] : [])],
      comment: $("fNote").value
    });
    Lead.busy(btn, false);
    if (!res.ok) { $("fErr").textContent = res.error; return; }
    $("formBox").innerHTML = `<div class="done" tabindex="-1" id="doneBox"><h3>Заявка отправлена</h3>
      <p>${name ? esc(name) + ", перезвоню" : "Перезвоню"} в рабочее время и подскажу варианты для ${esc(car)}.</p>
      ${res.demo ? '<p>Это черновик сайта: заявка сохранилась только в этом браузере.</p>' : ""}</div>`;
    $("doneBox").focus();
  });
})();
