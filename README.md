# ETF Depot

Static page plus one Netlify Function that looks up ETF prices.

- `public/index.html` – the dashboard (Depot and Browse tabs)
- `netlify/functions/quotes.mts` – `GET /api/quotes?isins=...` (prices from justETF's unofficial chart endpoint)

## Deploy

The Netlify project `etf-depot-tracker` already exists.

    npm install
    npx netlify-cli login
    npx netlify-cli link --id f15542bb-2be4-4d0c-8d15-f2db322396a3
    npx netlify-cli deploy --prod

Positions are stored in the browser (localStorage), never on the server.
