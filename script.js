'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const rubles = value => `${Number(value).toLocaleString('ru-RU')} ₽`;
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const icons = () => window.lucide?.createIcons();
const stepIds = ['design', 'amount', 'greeting', 'recipient', 'time', 'buyer'];
const stepLabels = ['Дизайн', 'Номинал', 'Поздравление', 'Получатель', 'Время', 'Оплата'];
const cards = [ ['classic', 'Классический зелёный'], ['texture', 'Зелёный фактурный'], ['flowers', 'Цветы'], ['home', 'sela.home'] ];
const defaults = () => ({design:'texture', customUrl:'', amount:1000, to:'', greeting:'', from:'', recipientName:'', recipientPhone:'', recipientEmail:'', buyerName:'', buyerPhone:'', buyerEmail:'', delivery:'now', date:'', time:'12:00', accepted:false});
let state = defaults();
let current = 'home';
let reached = 0;
let opener = null;
const generator = {person:'Маме', occasion:'День рождения', style:'Дружеский'};
const screen = $('#screen');
const modal = $('#modal');

function field(label, name, options = {}) {
  const {type = 'text', required = false, placeholder = '', max = 120, autocomplete = 'off'} = options;
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(state[name])}" placeholder="${placeholder}" ${required ? 'required' : ''} maxlength="${max}" autocomplete="${autocomplete}" ${type === 'tel' ? 'inputmode="tel"' : ''}></label>`;
}
function actions(back, label = 'Далее') {
  return `<p class="error" role="alert" id="form-error"></p><div class="screen-actions"><button type="submit" class="button">${label}</button></div>`;
}
function contactForm(prefix, back, heading, description) {
  return `<form id="step-form" novalidate><h2>${heading}</h2><p class="description">${description}</p><div class="contact-fields">${field('имя', `${prefix}Name`, {required:true, autocomplete:'given-name'})}${field('телефон', `${prefix}Phone`, {type:'tel', autocomplete:'tel'})}${field('e-mail', `${prefix}Email`, {type:'email',required:true, autocomplete:'email'})}</div>${actions(back)}</form>`;
}
function deliveryLabel() {
  if (state.delivery === 'now') return 'Сейчас, сразу после покупки';
  const date = new Date(`${state.date}T${state.time}:00+03:00`);
  return Number.isNaN(date.getTime()) ? 'Выберите дату и время' : `${date.toLocaleDateString('ru-RU', {day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'})}, ${state.time} (МСК)`;
}
function contactReview(prefix, title, route) {
  return `<div><h3>${title}</h3><dl><dt>имя</dt><dd>${esc(state[`${prefix}Name`])}</dd><dt>телефон</dt><dd>${esc(state[`${prefix}Phone`] || 'Не указан')}</dd><dt>e-mail</dt><dd>${esc(state[`${prefix}Email`])}</dd></dl><a class="review-edit" href="#${route}">Изменить</a></div>`;
}
const views = {
  design: () => `<form id="step-form"><h2>выберите дизайн сертификата</h2><p class="description">Выберите понравившийся дизайн карты или загрузите свой.<br>Так открытка придёт получателю на почту.</p><div class="design-grid" role="radiogroup" aria-label="Дизайн сертификата">${cards.map(([id,name]) => `<button type="button" class="design-choice" role="radio" aria-checked="${state.design===id}" tabindex="${state.design===id ? 0 : -1}" data-design="${id}" aria-label="${name}"><img src="assets/card-${id}.webp" alt=""><span class="selection-check">${icon('check')}</span></button>`).join('')}${state.customUrl ? `<button type="button" class="design-choice" role="radio" aria-label="Мой дизайн" aria-checked="${state.design==='custom'}" tabindex="${state.design==='custom' ? 0 : -1}" data-design="custom"><img src="${esc(state.customUrl)}" alt=""><span class="selection-check">${icon('check')}</span></button>` : ''}<button type="button" class="design-choice upload-choice" id="upload-button">${icon('circle-plus')}<span><strong>Загрузить свой дизайн</strong><small>формат файла — JPG/PNG до 15 МБ</small></span></button></div><input type="file" class="upload-input" id="upload-input" accept="image/png,image/jpeg">${actions(null)}</form>`,
  amount: () => `<form id="step-form" novalidate><h2>выберите номинал сертификата</h2><label class="field amount-field">сумма<input name="amount" type="number" inputmode="numeric" min="1000" max="50000" step="1" required value="${state.amount}" aria-describedby="amount-hint"></label><span class="amount-hint" id="amount-hint">${amountHint()}</span><div class="amount-grid" role="radiogroup" aria-label="Номинал сертификата">${[1000,3000,5000,10000,15000,20000,30000,50000].map(amount => `<button type="button" role="radio" class="choice" aria-checked="${state.amount===amount}" tabindex="${state.amount===amount ? 0 : -1}" data-amount="${amount}">${rubles(amount)}</button>`).join('')}</div>${actions('design')}</form>`,
  greeting: () => `<form id="step-form"><div class="greeting-heading"><h2>напишите поздравление</h2><button type="button" class="button green" data-dialog="generator">Сгенерировать поздравление</button></div><p class="description">Напишите или сгенерируйте поздравление<br>прямо на нашем сайте</p><div class="greeting-fields">${field('кому','to')}<label class="field">текст поздравления<textarea name="greeting" maxlength="800" rows="2">${esc(state.greeting)}</textarea></label>${field('от кого','from')}</div>${actions('amount')}</form>`,
  recipient: () => contactForm('recipient','greeting','укажите данные получателя','Карта придёт ссылкой в СМС или уведомлением на указанную электронную почту'),
  time: () => `<form id="step-form" novalidate><h2>выберите время отправки</h2><div class="time-options"><label class="radio-label"><input type="radio" name="delivery" value="now" ${state.delivery==='now'?'checked':''}>сейчас</label><label class="radio-label"><input type="radio" name="delivery" value="scheduled" ${state.delivery==='scheduled'?'checked':''}>выбрать время</label></div><div id="time-fields">${timeFields()}</div>${actions('recipient')}</form>`,
  buyer: () => contactForm('buyer','time','укажите ваши контактные данные','Пришлём электронный чек и подробности заказа'),
  review: () => `<form id="step-form" novalidate><h2>проверьте детали вашего заказа</h2><div class="review-grid">${contactReview('recipient','Получатель','recipient')}${contactReview('buyer','Отправитель','buyer')}<div><dl><dt>дата и время отправки</dt><dd>${esc(deliveryLabel())}</dd><dt>номинал сертификата</dt><dd>${rubles(state.amount)}</dd></dl><a class="review-edit" href="#time">Изменить</a></div></div><div class="review-pay"><h2>способ оплаты</h2><label class="radio-label"><input type="radio" checked name="payment" value="sbp">Система быстрых платежей (СБП)</label>${actions('buyer',`Оплатить, ${rubles(state.amount)}`)}<label class="consent"><input name="accepted" type="checkbox" required ${state.accepted?'checked':''}><span>Нажимая на кнопку «Оплатить», Вы принимаете условия правил продаж и подтверждаете, что ознакомлены с Политикой конфиденциальности.</span></label></div></form>`,
  payment: () => `<div class="payment-demo"><h2>оплата сертификата</h2><p>${rubles(state.amount)}</p><div class="payment-symbol">${icon('scan-line')}</div><p>Демонстрационный режим. Платёжный сервис пока не подключён: деньги не списываются, сертификат не отправляется.</p><button class="button" id="demo-complete">Посмотреть успешное оформление</button></div>`,
  success: () => `<div class="success-band"><h2>ваш заказ успешно оплачен!</h2></div><div class="success-info"><h2>Как отследить заказ?</h2><p>Демонстрация финального экрана. Реальный заказ не создан, оплата и отправка не выполнялись.</p></div><div class="success-info"><h2>Ваш сертификат</h2><p>${rubles(state.amount)} · ${esc(state.recipientName)} · ${esc(deliveryLabel())}</p></div><button id="restart" class="button green">Оформить ещё один сертификат</button>`,
};
function amountHint() {
  return state.amount < 3000 ? 'можно купить ≈ футболку' : state.amount < 10000 ? 'можно выбрать любимый образ' : 'на обновление гардероба';
}
function timeFields() {
  if (state.delivery==='now') return '<p class="time-description">Отправим карту на электронную почту сразу после покупки.</p>';
  return `<div class="scheduled-fields">${field('дата отправки','date',{type:'date',required:true})}${field('время отправки','time',{type:'time',required:true})}<small>Московское время</small></div>`;
}
function updatePreview() {
  $('#preview-image').src = state.design==='custom' ? state.customUrl : `assets/card-${state.design}.webp`;
  $('#preview-image').dataset.back = `assets/card-${state.design==='custom' ? 'classic' : state.design}-back.jpg`;
  document.dispatchEvent(new Event('certificate-preview-change'));
  $('#preview-caption').textContent = `Номинал ${rubles(state.amount)}. ${state.to ? `Для ${state.to}.` : ''} ${state.greeting}`;
}
function render() {
  let route = location.hash.slice(1) || 'home';
  if (route!=='home' && !views[route]) route='home';
  // Direct links to final screens must not bypass the required order details.
  if (['review','payment','success'].includes(route)) {
    if (!Number.isInteger(state.amount) || state.amount < 1000 || state.amount > 50000) route='amount';
    else if (!state.recipientName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.recipientEmail)) route='recipient';
    else if (!state.buyerName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.buyerEmail)) route='buyer';
    else if (state.delivery === 'scheduled' && !(new Date(`${state.date}T${state.time}:00+03:00`).getTime() > Date.now())) route='time';
  }
  current = route;
  $('#home').hidden = route!=='home';
  $('#order').hidden = route==='home';
  if (route!=='home') {
    const step = ['review','payment','success'].includes(route) ? 5 : stepIds.indexOf(route);
    reached = Math.max(step,reached);
    $('.steps').innerHTML = stepIds.map((id,i) => `${i ? `<span class="step-line ${i<=step?'completed':''}" aria-hidden="true"></span>`:''}<button class="step ${i===step?'current':i<step?'completed':''}" data-step="${id}" ${i>reached?'disabled':''} ${i===step?'aria-current="step"':''}><span class="step-number">${i+1}</span><span>${stepLabels[i]}</span></button>`).join('');
    screen.innerHTML=views[route]();
    $('.steps').hidden=['payment','success'].includes(route);
    $('.preview').hidden=['payment','success'].includes(route);
    $('.order-layout').style.display=['payment','success'].includes(route)?'block':'';
    updatePreview();
    wireScreen();
  }
  icons();
}
function navigate(route) {
  if (location.hash===`#${route}`) render(); else location.hash=route;
}
function showError(message, element) {
  $('#form-error').textContent=message;
  if(element){element.setAttribute('aria-invalid','true');element.focus();}
}
function validate() {
  const form=$('#step-form');
  const invalid=$$('input,textarea',form).find(input=>!input.checkValidity());
  if(invalid){showError(invalid.type==='email'?'Введите корректный e-mail.':invalid.type==='checkbox'?'Подтвердите согласие с условиями.':current==='amount'?'Укажите сумму от 1 000 до 50 000 ₽, без копеек.':'Заполните обязательное поле.',invalid);return false;}
  if(['recipient','buyer'].includes(current)){
    const prefix=current;
    const name=form.elements[`${prefix}Name`];
    if(!name.value.trim()){showError('Укажите имя.',name);return false;}
    const phone=form.elements[`${prefix}Phone`];
    if(phone.value && phone.value.replace(/\D/g,'').length<10){showError('Проверьте номер телефона.',phone);return false;}
  }
  if(current==='time' && state.delivery==='scheduled' && new Date(`${state.date}T${state.time}:00+03:00`).getTime()<=Date.now()){
    showError('Выберите будущее время отправки (МСК).',form.elements.date);return false;
  }
  return true;
}
function wireScreen() {
  const form=$('#step-form');
  form?.addEventListener('input',event=>{
    const input=event.target;
    if(input.name in state) state[input.name]=input.type==='checkbox'?input.checked:input.name==='amount'?Number(input.value):input.value;
    input.removeAttribute('aria-invalid');
    if($('#form-error')) $('#form-error').textContent='';
    if(input.name==='amount'){
      $$('[data-amount]').forEach(button=>{const selected=Number(button.dataset.amount)===state.amount;button.setAttribute('aria-checked',selected);button.tabIndex=selected?0:-1;});
      if(!$('.amount-grid [tabindex="0"]')) $('[data-amount]').tabIndex=0;
      $('#amount-hint').textContent=amountHint();
    }
    updatePreview();
  });
  form?.addEventListener('change',event=>{if(event.target.name==='delivery'){$('#time-fields').innerHTML=timeFields();}});
  form?.addEventListener('submit',event=>{
    event.preventDefault();
    if(!validate())return;
    if(current==='greeting'){
      state.recipientName ||= state.to;
      state.buyerName ||= state.from;
    }
    navigate(({design:'amount',amount:'greeting',greeting:'recipient',recipient:'time',time:'buyer',buyer:'review',review:'payment'})[current]);
  });
  $$('[data-design]').forEach(button=>button.addEventListener('click',()=>{
    state.design=button.dataset.design;
    $$('[data-design]').forEach(card=>{card.setAttribute('aria-checked',card===button);card.tabIndex=card===button?0:-1;});
    updatePreview();
  }));
  $$('[data-amount]').forEach(button=>button.addEventListener('click',()=>{
    const input=$('[name="amount"]');input.value=button.dataset.amount;input.dispatchEvent(new Event('input',{bubbles:true}));
  }));
  $('#upload-button')?.addEventListener('click',()=>$('#upload-input').click());
  $('#upload-input')?.addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    if(!['image/png','image/jpeg'].includes(file.type)||file.size>15*1024*1024){showError('Выберите JPG или PNG размером до 15 МБ.');return;}
    const url=URL.createObjectURL(file);
    const check=new Image();check.src=url;
    try{await check.decode();}catch{URL.revokeObjectURL(url);showError('Не удалось открыть изображение. Попробуйте другой файл.');return;}
    if(state.customUrl)URL.revokeObjectURL(state.customUrl);
    state.customUrl=url;state.design='custom';render();
  });
  $('#demo-complete')?.addEventListener('click',()=>navigate('success'));
  $('#restart')?.addEventListener('click',()=>{if(state.customUrl)URL.revokeObjectURL(state.customUrl);state=defaults();reached=0;navigate('design');});
}

function openModal(content) {
  opener=document.activeElement;
  $('#modal-content').innerHTML=content;
  if(!modal.open)modal.showModal();
  icons();
}
function generatorModal() {
  const groups=[['person','Для кого',['Маме','Подруге','Коллеге','Мужу','Жене','Другу','Сестре','Брату']],['occasion','По какому случаю',['День рождения','Благодарность','Юбилей','Свадьба','Новый год','8 марта','Подарок']],['style','В каком стиле',['Дружеский','Деловой','Романтичный','С юмором','Официальный','В стихах','Кратко']]];
  openModal(`<h2 id="modal-title">сгенерировать поздравление</h2>${groups.map(([key,title,choices])=>`<fieldset class="generator-fieldset"><legend>${title}</legend><div class="generator-choices" role="radiogroup" aria-label="${title}">${choices.map(choice=>`<button class="choice" role="radio" tabindex="${generator[key]===choice?0:-1}" aria-checked="${generator[key]===choice}" data-group="${key}" data-value="${choice}">${choice}</button>`).join('')}</div></fieldset>`).join('')}<div class="generator-submit"><button class="button" id="generate">Сгенерировать</button></div>`);
  $$('[data-group]',modal).forEach(button=>button.addEventListener('click',()=>{
    generator[button.dataset.group]=button.dataset.value;
    $$(`[data-group="${button.dataset.group}"]`,modal).forEach(choice=>{choice.setAttribute('aria-checked',choice===button);choice.tabIndex=choice===button?0:-1;});
  }));
  $('#generate').addEventListener('click',()=>{
    const addresses={'Маме':'Мама','Подруге':'Дорогая подруга','Коллеге':'Уважаемый коллега','Мужу':'Любимый','Жене':'Любимая','Другу':'Дорогой друг','Сестре':'Сестрёнка','Брату':'Брат'};
    const openings={'День рождения':'С днём рождения!','Благодарность':'Спасибо за заботу, поддержку и всё хорошее!','Юбилей':'С юбилеем!','Свадьба':'Поздравляю с днём свадьбы!','Новый год':'С Новым годом!','8 марта':'С 8 Марта!','Подарок':'Этот подарок для тебя!'};
    const wishes={'Дружеский':'Пусть каждый день приносит радость, тёплые встречи и приятные открытия. Выбери то, что подарит хорошее настроение!','Деловой':'Желаю благополучия, вдохновения и успехов во всех начинаниях. Примите этот подарок с наилучшими пожеланиями.','Романтичный':'Ты делаешь мою жизнь счастливее. Пусть этот маленький сюрприз напомнит, как много ты для меня значишь.','С юмором':'Желаю, чтобы счастье всегда было твоего размера, а хорошее настроение никогда не выходило из моды!','Официальный':'Примите искренние поздравления и пожелания здоровья, благополучия и новых достижений.','В стихах':'Пусть будет радостным рассвет,\nИ каждый день теплом согрет.\nПусть сбудутся твои мечты,\nИ будет больше красоты!','Кратко':'Счастья, вдохновения и приятных покупок!'};
    state.greeting=`${state.to || addresses[generator.person]}! ${openings[generator.occasion]}\n${wishes[generator.style]}`;
    modal.close();
    if(current==='greeting'){$('[name="greeting"]').value=state.greeting;updatePreview();}
  });
}
function serviceModal(type) {
  const titles={balance:'проверить баланс',pin:'получить ПИН-код',search:'поиск',account:'личный кабинет',favorites:'избранное',basket:'корзина',info:'информация',about:'о sela.',stores:'магазины',apps:'приложение sela.',social:'социальные сети',privacy:'конфиденциальность',subscription:'подписка'};
  if(type==='generator'){generatorModal();return;}
  if(type==='city'){
    openModal('<h2 id="modal-title">ваш город</h2><form id="city-form"><label class="field">Город<input name="city" value="'+esc($('.city').textContent)+'" required maxlength="40"></label><button class="button">Сохранить</button></form>');
    $('#city-form').addEventListener('submit',event=>{event.preventDefault();$('.city').textContent=event.target.elements.city.value.trim()||'Москва';modal.close();});return;
  }
  const text={account:'Личный кабинет станет доступен после подключения сервиса авторизации.',favorites:'У вас пока нет избранных товаров.',basket:'В корзине пока нет товаров. Подарочный сертификат оформляется отдельно.',info:'Электронный подарочный сертификат: выберите дизайн и номинал, добавьте поздравление и укажите получателя.',about:'Подарочный сертификат sela. для близких, друзей и коллег.',stores:'Актуальные адреса магазинов доступны на официальном сайте sela.ru.',apps:'Приложение sela. можно найти по названию в App Store, Google Play или RuStore.',social:'Официальные страницы бренда доступны на сайте sela.ru.',privacy:'В этой локальной версии данные форм используются только для предпросмотра. Они не отправляются на сервер и сбрасываются при обновлении страницы.',subscription:'Подписка не отправлена: сервис рассылки пока не подключён.'};
  if(['balance','pin','search'].includes(type)){
    const fields=type==='search'?'<label class="field">Поиск<input name="query" required placeholder="Подарочный сертификат"></label>':`<label class="field">Номер сертификата<input name="number" inputmode="numeric" required minlength="8" maxlength="32"></label>${type==='balance'?'<label class="field">ПИН-код<input name="pin" inputmode="numeric" required minlength="4" maxlength="8"></label>':'<label class="field">E-mail покупателя<input type="email" name="email" required></label>'}`;
    openModal(`<h2 id="modal-title">${titles[type]}</h2><div class="modal-text"><form id="service-form">${fields}<button class="button">${type==='search'?'Найти':type==='balance'?'Проверить':'Получить код'}</button></form><div id="service-status" role="status"></div></div>`);
    $('#service-form').addEventListener('submit',event=>{event.preventDefault();$('#service-status').className='modal-status';$('#service-status').innerHTML=type==='search'?'<a href="#design" id="search-result">Подарочный сертификат sela.</a>':type==='balance'?'Проверка баланса недоступна: сервис сертификатов ещё не подключён.':'ПИН-код не отправлен: сервис сертификатов ещё не подключён.';$('#search-result')?.addEventListener('click',()=>modal.close());});return;
  }
  openModal(`<h2 id="modal-title">${titles[type]||'информация'}</h2><div class="modal-text"><p>${text[type]||''}</p>${type==='basket'?'<p><a class="button green" href="#design" id="basket-order">Оформить сертификат</a></p>':''}</div>`);
  $('#basket-order')?.addEventListener('click',()=>modal.close());
}
document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-dialog]');if(trigger)serviceModal(trigger.dataset.dialog);
  const step=event.target.closest('[data-step]');if(step&&!step.disabled)navigate(step.dataset.step);
});
document.addEventListener('keydown',event=>{
  const radio=event.target.closest('[role="radio"]');
  if(!radio||!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  event.preventDefault();const choices=$$('[role="radio"]',radio.closest('[role="radiogroup"]'));
  const index=choices.indexOf(radio),direction=['ArrowRight','ArrowDown'].includes(event.key)?1:-1;
  const next=event.key==='Home'?0:event.key==='End'?choices.length-1:(index+direction+choices.length)%choices.length;
  choices[next].click();choices[next].focus();
});
$('.modal-close').addEventListener('click',()=>modal.close());
modal.addEventListener('click',event=>{if(event.target===modal){const box=modal.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)modal.close();}});
modal.addEventListener('close',()=>{if(opener?.isConnected)opener.focus();});
$('.subscription').addEventListener('submit',event=>{event.preventDefault();serviceModal('subscription');});
const faqs=[['Сколько действует сертификат?','Срок действия указан в письме с сертификатом. Его также можно уточнить по номеру карты у службы поддержки.'],['А если покупка дороже номинала?','Разницу можно доплатить другим доступным способом оплаты.'],['Можно потратить не всё сразу?','Да, сертификат можно использовать частично. Неиспользованный остаток сохраняется на карте.'],['Сертификат именной?','Имя на открытке — часть поздравления. При использовании сертификата понадобятся его номер и ПИН-код.'],['Можно ли купить несколько сертификатов?','Да. После оформления одного сертификата можно вернуться и подготовить следующий.']];
$('#faq-list').innerHTML=faqs.map(([question,answer])=>`<details><summary>${question}${icon('plus')}</summary><p>${answer}</p></details>`).join('');
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);$('#main').focus({preventScroll:true});});
render();
