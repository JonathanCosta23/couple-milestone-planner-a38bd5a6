import fs from "node:fs";
import process from "node:process";
import { JSDOM, VirtualConsole } from "jsdom";

const file = process.argv[2];
if (!file) throw new Error("Informe o caminho do HTML público.");

const html = fs.readFileSync(file, "utf8");
const errors = [];
const messages = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => errors.push(error));
virtualConsole.on("error", (...args) => messages.push(`console.error: ${args.join(" ")}`));
virtualConsole.on("warn", (...args) => messages.push(`console.warn: ${args.join(" ")}`));

const dom = new JSDOM(html, {
  url: "https://ytuzerdwjffqgzltjnoo.supabase.co/functions/v1/nossa-rotina/",
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.fetch = globalThis.fetch;
    window.scrollTo = () => {};
    window.confirm = () => true;
    window.WebSocket = class WebSocketStub {
      static OPEN = 1;
      readyState = 1;
      addEventListener() {}
      removeEventListener() {}
      close() {}
      send() {}
    };
  },
});

const deadline = Date.now() + 10000;
while (Date.now() < deadline) {
  const boot = dom.window.document.getElementById("boot");
  const auth = dom.window.document.getElementById("authView");
  const visible = auth && !auth.classList.contains("hidden") && /Nossa Rotina|Entrar/.test(auth.textContent || "");
  if (boot?.classList.contains("hidden") && visible) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const boot = dom.window.document.getElementById("boot");
const auth = dom.window.document.getElementById("authView");
const authVisible = auth && !auth.classList.contains("hidden") && /Nossa Rotina|Entrar/.test(auth.textContent || "");
const diagnostics = [
  ...errors.map((error) => `jsdom: ${error.message}`),
  ...messages,
  `bootClass=${boot?.className || "missing"}`,
  `authClass=${auth?.className || "missing"}`,
  `authText=${(auth?.textContent || "").trim().slice(0, 160)}`,
].join(" | ");

if (!boot?.classList.contains("hidden")) {
  throw new Error(`A tela de carregamento permaneceu visível. ${diagnostics}`);
}
if (!authVisible) {
  throw new Error(`A tela de autenticação não foi renderizada. ${diagnostics}`);
}
if (errors.length) {
  throw new Error(`Erros de execução detectados. ${diagnostics}`);
}

console.log("Nossa Rotina executou e exibiu a tela de autenticação.");
dom.window.close();
