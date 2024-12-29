declare global {
    namespace NodeJS {
        interface ProcessEnv {
            BOT_TOKEN: string
            API_ADDRESS: string
        }
    }
}

export { }