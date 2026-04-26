const fs = require('fs');
const file = 'c:/Raw_Xo/client/src/index.css';
let content = fs.readFileSync(file, 'utf8');

const startToken = `  .btn-secondary:hover {`;
const endToken = `    border-radius: 50%;\r\n    background: rgba(255, 255, 255, 0.12);\r\n    cursor: pointer;`;
const endTokenAlternative = `    border-radius: 50%;\n    background: rgba(255, 255, 255, 0.12);\n    cursor: pointer;`;

let p1 = content.indexOf(startToken);
let p2 = content.indexOf(endToken, p1);
let endLength = endToken.length;
if (p2 === -1) {
    p2 = content.indexOf(endTokenAlternative, p1);
    endLength = endTokenAlternative.length;
}

if (p1 !== -1 && p2 !== -1) {
    const safeContent = `  .btn-secondary:hover {
    color: var(--text-1);
    border-color: rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.02);
  }

  .btn-secondary:active {
    transform: scale(0.99);
  }

  /* ── Nav links ── */
  .nav-link {
    position: relative;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-2);
    letter-spacing: 0.01em;
    transition: color 0.8s var(--ease-cinematic);
    padding-bottom: 2px;
  }

  .nav-link::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -2px;
    height: 1px;
    background: var(--text-1);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.8s var(--ease-cinematic);
  }

  .nav-link:hover {
    color: var(--text-1);
  }

  .nav-link:hover::after,
  .nav-link-active::after {
    transform: scaleX(1);
  }

  .nav-link-active {
    color: var(--text-1);
  }

  /* ── Rating dots ── */
  .rating-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    cursor: pointer;`;

    content = content.substring(0, p1) + safeContent + content.substring(p2 + endLength);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed successfully.");
} else {
    console.log("Could not find the tokens.");
}
