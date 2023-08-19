import fetch from 'node-fetch';
import fs from 'fs';

const fetchData = async () => {
    let json;
    try {
        const response = await fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=SOL', {
            headers: {
                'X-CMC_PRO_API_KEY': config.key
            }
        })

        json = await response.json();
    } catch (error) {
        console.log(error);
    }

    const sol = json.data.SOL.quote.USD;

    // calculate sales volume
    sol.volume = Math.round(sol.volume_24h / sol.price);
    const last = await solvolget();

    // volume difference in SOL
    sol.diffsol = Math.round(sol.volume - last.volume);

    // volume difference in USD
    sol.diffusd = Math.round(sol.volume_24h - last.volume_24h);

    const current = {
        timestamp: sol.last_updated,
        volume: Math.round(sol.volume_24h / sol.price),
        price: (sol.price).toFixed(2),
        diffsol: sol.diffsol,
        diffusd: sol.diffusd
    };
    console.log(current);
    await solvolput("solana", "solvol", current);
};

fetchData();


