import svgCaptcha from 'svg-captcha';

const PALETTE = ['#8A9099', '#7A8B99', '#8FA3B3', '#5A7A62', '#8C7A4F'];
const BACKGROUND = '#141619';

export function createCaptchaSvg(): { svg: string; answer: string } {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    color: false,
    background: BACKGROUND,
    ignoreChars: '0o1ilI',
    width: 132,
    height: 44,
    fontSize: 40,
    charPreset: '23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
  });
  let index = 0;
  const svg = captcha.data
    .replace(/fill="[^"]*"/g, () => {
      const color = PALETTE[index % PALETTE.length];
      index += 1;
      return `fill="${color}"`;
    })
    .replace(/stroke="[^"]*"/g, () => {
      const color = PALETTE[index % PALETTE.length];
      index += 1;
      return `stroke="${color}"`;
    });
  return { svg, answer: captcha.text.toLowerCase() };
}
