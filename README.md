# Mih Temperos

Catálogo online da Mih Temperos — "Sabores que transformam". Um PWA leve (React + Vite) para o cliente ver os produtos, montar o carrinho e finalizar o pedido direto pelo WhatsApp, com Pix como forma de pagamento.

## Como funciona

- O catálogo de produtos é lido de uma planilha do Google Sheets publicada como CSV (aba "produtos").
- O carrinho fica salvo no `localStorage` do navegador, sobrevivendo a recarregamentos de página.
- O cliente escolhe **Retirar no local** (grátis) ou **Entrega** (com taxa fixa) e uma janela de horário para o dia seguinte.
- Ao finalizar, o pedido é montado como uma mensagem e enviado via `wa.me` para o WhatsApp da loja.
- É um PWA (instalável, com ícone e atualização automática do service worker).

## Rodando localmente

```bash
make run
```

Isso instala as dependências (se necessário) e sobe o servidor de desenvolvimento em `http://localhost:5173`, abrindo o navegador automaticamente.

Outros comandos úteis:

```bash
make install   # instala as dependências
make build     # build de produção
make preview   # serve o build de produção localmente
make lint      # roda o eslint
```

Requer Node 20.19+ ou 22.12+ (veja `.tool-versions`).

## Configuração

Os principais pontos de configuração estão no topo de `src/App.tsx`:

- `SHEET_URL` — link de exportação CSV da planilha de produtos (Google Sheets → Compartilhar → Publicar na web → CSV).
- `SHIPPING_FEE` / `MIN_ORDER` — taxa de entrega e pedido mínimo.
- Número do WhatsApp usado no checkout (`phone`, dentro de `handleWhatsAppCheckout`).
- `PICKUP_ADDRESS` — endereço mostrado para quem escolhe retirar no local.

A planilha de produtos precisa ter, por coluna: id, nome, preço, tipo de unidade (`weight`/`unit`), incremento, mínimo, categoria e imagem.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- `vite-plugin-pwa` (PWA/service worker)
- Deploy: Vercel
