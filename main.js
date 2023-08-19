import { exec } from 'child_process';
import tweeter from './tweeter.js';
import cron from 'cron';
import { config } from './config.js';
import fs from 'fs';
import fetch from 'node-fetch';

const when = process.argv[2];
const LAMPORTS_PER_SOL = 1000000000;
class EpochInfo {
    constructor(epochInfo, validators, slot, supply) {
        this.epochInfo = epochInfo;
        this.validators = validators;
        this.slot = slot;
        this.supply = supply;
        this.validatorCurrent = 0;
        this.validatorDelinquient = 0;
    }

    async fetchData() {
        try {
            const epochInfoCommand = 'solana epoch-info --output json';
            const validatorsCommand = 'solana validators --output json';
            const slotCommand = 'solana slot --output json';
            const supplyCommand = 'solana supply --output json';
            const blockCommand = 'solana block --output json';

            const [epochInfoData, validatorsData, slotData, supplyData, blockData] = await Promise.all([
                executeCommand(epochInfoCommand),
                executeCommand(validatorsCommand),
                executeCommand(slotCommand),
                executeCommand(supplyCommand),
                executeCommand(blockCommand),
            ]);

            this.epochInfo = JSON.parse(epochInfoData);
            this.validators = JSON.parse(validatorsData);
            this.slot = JSON.parse(slotData);
            this.supply = JSON.parse(supplyData);
            this.block = JSON.parse(blockData);

            this.validators.validators.map((validator) => {
                if (!validator.delinquent) {
                    this.validatorCurrent += 1;
                }
                if (validator.delinquent) {
                    this.validatorDelinquient += 1;
                }
            });
        } catch (error) {
            console.error(error);
        }
    }
}
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(
            command,
            { maxBuffer: 10000 * 10000 },
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Error: ${error.message}`));
                    return;
                }
                if (stderr) {
                    reject(new Error(stderr));
                    return;
                }
                resolve(stdout.trim());
            }
        );
    });
}
async function getTPS() {
    try {
        let bodyContent = JSON.stringify({ "jsonrpc": "2.0", "id": 1, "method": "getRecentPerformanceSamples", "params": [1] });

        let response = await fetch("https://api.mainnet-beta.solana.com", {
            method: "POST",
            body: bodyContent,
            headers: { "Content-Type": "application/json" }
        });

        let data = await response.json();
        console.log(data);
        return data;
    } catch (error) {
        console.error(error);
    }
}
async function getVol() {
    try {

        const response = await fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=SOL', {
            headers: {
                'X-CMC_PRO_API_KEY': config.cmc_key
            }
        })

        let json = await response.json();

        const newData = json.data.SOL.quote.USD;

        // calculate sales volume
        const volsol = Math.round(newData.volume_24h / newData.price);
        const last = JSON.parse(fs.readFileSync('vol.json', 'utf8'));

        // volume difference in SOL
        const diffsol = Math.round(volsol - last.volsol);

        // volume difference in USD
        const diffusd = Math.round(newData.volume_24h - last.volusd);

        const current = {
            timestamp: newData.last_updated,
            price: (newData.price).toFixed(2),
            volusd: Math.round(newData.volume_24h),
            volsol: volsol,
            diffusd: diffusd,
            diffsol: diffsol
        };
        // console.log(current);
        fs.writeFileSync('vol.json', JSON.stringify(current, null, 2));
        return current;
    } catch (error) {
        console.error(error);
    }
}

const job = cron.job(when || '0 * * * * *', async () => {
    (async () => {
        const tweet = new EpochInfo();
        try {
            await tweet.fetchData();
            const tps = await getTPS();
            const volume = await getVol();
            const template = `Price: $${volume.price} 💸
TPS: ${(tps.result[0].numTransactions / tps.result[0].samplePeriodSecs).toFixed(0)} 💨
Tx/Block: ${tweet.block.transactions.length} 📈
Volume: ${volume.diffsol}Ⓞ / $${volume.diffusd} 💹
Total Transactions: ${tweet.epochInfo.transactionCount.toLocaleString()} 🤯
Block: ${tweet.epochInfo.absoluteSlot.toLocaleString()} 🧱
Epoch: ${tweet.epochInfo.epoch} / ${(tweet.epochInfo.epochCompletedPercent).toFixed(2)}% ⏰
Total Supply (Circ / Non): ${(tweet.supply.total / LAMPORTS_PER_SOL / 1_000_000).toFixed(0)}m (${(tweet.supply.circulating / LAMPORTS_PER_SOL / 1_000_000).toFixed(0)} / ${(tweet.supply.nonCirculating / LAMPORTS_PER_SOL / 1_000_000).toFixed(0)}) 💰
Validators (Current / Delinquient): ${tweet.validators.validators.length} (${tweet.validatorCurrent} / ${tweet.validatorDelinquient}) 🧳`
            console.log(template);
            await tweeter(template);
        } catch (error) {
            console.error(error);
        }
    })();
})
job.start();

