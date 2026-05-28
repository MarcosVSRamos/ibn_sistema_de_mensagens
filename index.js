import 'dotenv/config'

import baileys from '@whiskeysockets/baileys'

const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState
} = baileys

import qrcode from 'qrcode-terminal'

import { google } from 'googleapis'

import cron from 'node-cron'

let sistemaIniciado = false

async function conectarWhatsApp() {
    
    const { state, saveCreds } = await useMultiFileAuthState('auth')

    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {

        if (!sock.authState.creds.registered) {

    const numero = '556799522956'

    const code = await sock.requestPairingCode(numero)

    console.log(`\nCódigo de pareamento: ${code}\n`)
}

        if(connection === 'open') {

            console.log('\nWhatsApp conectado!\n')

            if(!sistemaIniciado) {

                sistemaIniciado = true
                iniciarSistema(sock)
            }
        }

        if(connection === 'close') {

            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

            console.log('\nConexão fechada\n')

            if(shouldReconnect) {

                console.log('Reconectando...\n')

                conectarWhatsApp()
            }
        }
    })
}

function iniciarSistema(sock) {

    console.log('Sistema iniciado.\n')

    verificarEscalas(sock)

    cron.schedule('0 8 * * *', async () => {

        console.log('Verificando escalas...\n')

        await verificarEscalas(sock)

    }, {
        timezone: 'America/Campo_Grande'
    })
}

async function verificarEscalas(sock) {

    const authConfig = process.env.GOOGLE_CREDENTIALS
    ? {
        credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS)
    }
    : {
        keyFile: 'credentials.json'
    }

    const auth = new google.auth.GoogleAuth({
        ...authConfig,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    const client = await auth.getClient()

    const sheets = google.sheets({
        version: 'v4',
        auth: client
    })

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: 'Sheet1!A:D'
    })

    const rows = response.data.values

    const hoje = new Date()
        .toLocaleDateString('sv-SE', {
            timeZone: 'America/Campo_Grande'
        })

    console.log('Hoje:', hoje)

    let encontrouEscala = false

    for(let i = 1; i < rows.length; i++) {

        const data = rows[i][0]
        const nome = rows[i][1]
        const funcao = rows[i][2]
        const telefone = rows[i][3]

        if(data === hoje) {

            encontrouEscala = true

            const mensagem = `
Olá ${nome}!

Essa é uma mensagem automática
para ajudar a lembrar que
você está escalado hoje 🙏

Qualquer coisa me chama aqui!

Função: ${funcao}

Deus abençoe!
            `

            const numero = telefone + '@s.whatsapp.net'

            await sock.sendMessage(numero, {
                text: mensagem
            })

            console.log(`Mensagem enviada para ${nome}`)
        }
    }

    if(!encontrouEscala) {

        console.log('Nenhuma escala encontrada para hoje.\n')
    }
}

setTimeout(() => {
    conectarWhatsApp()
}, 5000)