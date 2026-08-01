import fs from "node:fs";
import process from "node:process";
import { JSDOM, VirtualConsole } from "jsdom";

const file = process.argv[2];
if (!file) throw new Error("Informe o caminho do HTML público.");

const html = fs.readFileSync(file, "utf8");
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => errors.push(error));
virtualConsole.on("error", (error) => errors.push(error));

const dom = new JSDOM(html, {
  url: "https://ytuzerdwjffqgzltjnoo.supabase.co/functions/v1/nossa-rotina/",
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.fetch = globalThis.fetch;
    window.crypto = globalThis.crypto;
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

const deadline = Date.now() + 8000;
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

if (!boot?.classList.contains("hidden")) {
  throw new Error("A tela de carregamento permaneceu visível.");
}
if (!authVisible) {
  throw new Error("A tela de autenticação não foi renderizada.");
}
if (errors.length) {
  throw new Error(`Erros de execução detectados: ${errors.map((error) => error.message).join(" | ")}`);
}

console.log("Nossa Rotina executou e exibiu a tela de autenticação.");
dom.window.close();
