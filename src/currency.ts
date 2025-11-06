import { CurrencyConversions, ExchangeData, ExchangeRate, YtCurrencyMap } from './interfaces/general';

export async function loadCurrencyConversions() {
    const currencyJsonUrl = 'https://bcd-api-dca-ipa.cbsa-asfc.cloud-nuage.canada.ca/exchange-rate-lambda/exchange-rates';
    try {
        const res = await fetch(currencyJsonUrl);
        const data: ExchangeData = await res.json();

        const exchangeToCAD: CurrencyConversions = {};
        data.ForeignExchangeRates.forEach((rate: ExchangeRate) => {
            if (rate.ToCurrency.Value !== 'CAD') return;

            const fromCurrency = rate.FromCurrency.Value;
            const rateValue = parseFloat(rate.Rate);
            if (!isNaN(rateValue)) {
                exchangeToCAD[fromCurrency] = rateValue;
            }
        });
        if (!('USD' in exchangeToCAD)) throw new Error('USD to CAD rate not found');

        const usdRate = exchangeToCAD['USD'];

        const exchangeToUSD: CurrencyConversions = {};
        for (const [currency, rate] of Object.entries(exchangeToCAD)) {
            exchangeToUSD[currency] = rate / usdRate;
        }

        const ytMap = getYtCurrencyMap();
        for (const [ytCurrency, actualCode] of Object.entries(ytMap)) {
            if (!(actualCode in exchangeToUSD)) continue;
            exchangeToUSD[ytCurrency] = exchangeToUSD[actualCode];
        }

        return exchangeToUSD;
    } catch (error) {
        throw new Error('Failed to load currency conversions');
    }
}

export function getYtCurrencyMap(): YtCurrencyMap {
    const mapping: YtCurrencyMap = {
        '$': 'USD',
        'CA$': 'CAD',
        'A$': 'AUD',
        'HK$': 'HKD',
        'R$': 'BRL',
        'NT$': 'TWD',
        'MX$': 'MXN',
        '€': 'EUR',
        '£': 'GBP',
        '¥': 'JPY',
        '₱': 'PHP',
        '₩': 'KRW',
    };
    return mapping;
}

export function currencyCodeFromYtLabel(ytLabel: string): string {
    const ytMap = getYtCurrencyMap();

    if (ytLabel in ytMap) return ytMap[ytLabel];
    if (ytLabel.match(/^[A-Z]{3}$/)) return ytLabel;
    return '???';
}
