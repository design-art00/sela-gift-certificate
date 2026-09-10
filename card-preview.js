const button = document.querySelector('.card-turn');
const fallback = document.querySelector('#preview-image');
const canvas = button?.querySelector('.card-canvas');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (button && fallback) {
  const preview = document.createElement('span');
  preview.className = 'card-css-preview';
  preview.setAttribute('aria-hidden', 'true');
  preview.innerHTML = `<span class="card-css-inner"><img class="card-css-face card-css-front" alt=""><img class="card-css-face card-css-back" alt=""></span>`;
  button.append(preview);

  const front = preview.querySelector('.card-css-front');
  const back = preview.querySelector('.card-css-back');

  function updateImages() {
    front.src = fallback.src;
    back.src = fallback.dataset.back || 'assets/card-texture-back.jpg';
  }

  function spin() {
    if (reducedMotion.matches) return;
    preview.classList.remove('is-spinning');
    void preview.offsetWidth;
    preview.classList.add('is-spinning');
  }

  preview.addEventListener('animationend', () => preview.classList.remove('is-spinning'));
  button.addEventListener('mouseenter', spin);
  button.addEventListener('click', spin);
  document.addEventListener('certificate-preview-change', () => {
    updateImages();
    spin();
  });
  reducedMotion.addEventListener('change', () => { if (!reducedMotion.matches) spin(); });

  fallback.style.display = 'none';
  if (canvas) canvas.style.display = 'none';
  updateImages();
  if (!reducedMotion.matches) setTimeout(spin, 120);
}
