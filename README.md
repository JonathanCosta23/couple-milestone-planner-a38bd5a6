# Nossa Rotina — Jonathan & Isabella

Aplicativo compartilhado para organizar as rotinas individuais de Jonathan e Isabella, com visão semanal conjunta, modos de trabalho e sincronização pelo Supabase.

## Abrir o aplicativo

**Aplicativo online:**

https://ytuzerdwjffqgzltjnoo.supabase.co/functions/v1/nossa-rotina/

> O endereço `https://github.com/JonathanCosta23/couple-milestone-planner-a38bd5a6.git` é usado para clonar o código e não abre o aplicativo no navegador.

## Recursos

- Login individual para Jonathan e Isabella.
- Espaço compartilhado por código de convite.
- Rotinas separadas por pessoa.
- Visão semanal lado a lado.
- Modos Home office, Presencial, Folga e Personalizado.
- Criação, edição, exclusão e ordenação de tarefas.
- Configuração de trabalho, deslocamento, inglês, Salesforce, academia, alimentação e sono.
- Sincronização em tempo real no Supabase.
- Interface responsiva para celular e computador.

## Estrutura

- `nossa-rotina/`: frontend HTML, CSS e JavaScript.
- `supabase/functions/nossa-rotina/`: hospedagem pública em uma Supabase Edge Function.
- `supabase/migrations/`: tabelas, funções, RLS e índices do banco.
- `.github/workflows/deploy-nossa-rotina-pages.yml`: validação automática do código e do endereço público.

## Executar localmente

Sirva a pasta `nossa-rotina` por HTTP. Não abra o arquivo diretamente com `file://`, porque autenticação e redirecionamentos dependem de uma origem HTTP.

Exemplo com Python:

```bash
cd nossa-rotina
python -m http.server 8080
```

Depois abra:

```text
http://localhost:8080
```

## Aplicação React original

O repositório também contém uma aplicação React/Vite anterior na raiz. O produto **Nossa Rotina** utilizado por Jonathan e Isabella está na pasta `nossa-rotina` e é publicado pelo Supabase.
