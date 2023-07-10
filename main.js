import { exec } from 'child_process';
import tweeter from './tweeter.js';
import cron from 'cron';

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
        return data;
    } catch (error) {
        console.error(error);
    }
}

async function fetchQuote() {
    try {
        let response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,solana-aud&vs_currencies=usd');
        let data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
    }
}

cron.job('*/5 * * * *', async () => {

    (async () => {
        const tweet = new EpochInfo();

        try {
            await tweet.fetchData();
            const tps = await getTPS();
            const price = await fetchQuote();

            const template = `
Price: $${price.solana.usd} 💸
TPS: ${(tps.result[0].numTransactions / tps.result[0].samplePeriodSecs).toFixed(0)} 💨
Tx/Block: ${tweet.block.transactions.length} 📈
Total Transactions: ${tweet.epochInfo.transactionCount.toLocaleString()} 🤯
Latest Block: ${tweet.epochInfo.absoluteSlot.toLocaleString()} 🧱
Current Epoch: ${tweet.epochInfo.epoch} / ${(tweet.epochInfo.epochCompletedPercent).toFixed(2)}% ⏰
Total Supply (Circ / Non): ${(tweet.supply.total / LAMPORTS_PER_SOL / 1_000_000).toFixed(0)}m (${(tweet.supply.circulating / LAMPORTS_PER_SOL / 1_000_000).toFixed(0)} / ${(tweet.supply.nonCirculating / LAMPORTS_PER_SOL / 1_000_000).toFixed(0)}) 💰
Validators (Current / Delinquient): ${tweet.validators.validators.length} (${tweet.validatorCurrent} / ${tweet.validatorDelinquient}) 🧳
                        `
            console.log(template);

            await tweeter(template);

        } catch (error) {
            console.error(error);
        }
    })();
}).start();
