export interface User {
    channelId: string;
    isMember: boolean;
    isMod: boolean;
    isOwner: boolean;
    cssClasses: string[];
    name: string;
}

export interface YtCurrencyMap {
    [key: string]: string;
}

export interface CurrencyConversions {
    [key: string]: number;
}

export interface ExchangeRate {
    ExchangeRateId: number;
    Rate: string;
    FromCurrency: {
        Value: string;
    };
    ToCurrency: {
        Value: string;
    };
}

export interface ExchangeData {
    ForeignExchangeRates: ExchangeRate[];
}
