const COLLARS = [
  { name: 'Butter', color: '#F4E4A8' },
  { name: 'Salmon', color: '#F7C9BE' },
  { name: 'Lime', color: '#D6EBA8' },
  { name: 'Teal', color: '#A8DBD4' },
  { name: 'Purple', color: '#CFC1E9' },
];

const DEVICES = [
  { key: 'nude', label: 'Nude', color: '#E4CDB6', stage: '#F6EFE7' },
  { key: 'graphite', label: 'Graphite', color: '#3A3A3C', stage: '#EDEBE6' },
];

function initShopConfigurator(root) {
  const swatches = root.querySelectorAll('.swatch');
  const finishes = root.querySelectorAll('.finish');
  const stage = root.querySelector('.shop-stage');
  const collarEl = root.querySelector('.shop-collar');
  const deviceEl = root.querySelector('.shop-device');
  const collarValueEl = root.querySelector('[data-collar-value]');
  const deviceValueEl = root.querySelector('[data-device-value]');

  swatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.collarIndex);
      const collar = COLLARS[index];
      swatches.forEach((s) => s.classList.remove('selected'));
      btn.classList.add('selected');
      collarEl.style.background = collar.color;
      collarValueEl.textContent = collar.name;
    });
  });

  finishes.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.deviceKey;
      const device = DEVICES.find((d) => d.key === key);
      finishes.forEach((f) => f.classList.remove('selected'));
      btn.classList.add('selected');
      deviceEl.style.background = device.color;
      deviceValueEl.textContent = device.label;
      stage.style.background = device.stage;
    });
  });
}

document.querySelectorAll('[data-shop-configurator]').forEach(initShopConfigurator);
