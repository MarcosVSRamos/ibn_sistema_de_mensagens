import 'dotenv/config'

import baileys from '@whiskeysockets/baileys'

const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState
} = baileys


import QRCode from 'qrcode'

import { google } from 'googleapis'

import cron from 'node-cron'

let sistemaIniciado = false
let reconectando = false

async function conectarWhatsApp() {

    if (reconectando) return

    reconectando = true

    try {

        const { state, saveCreds } = await useMultiFileAuthState('auth')

        const { version } = await fetchLatestBaileysVersion()

        const sock = makeWASocket({
            version,
            auth: state,
            browser: ['Chrome', 'Desktop', '1.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: false
        })

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {

            if (qr) {

                const qrBase64 = await QRCode.toDataURL(qr, {
                    width: 500,
                    margin: 2
                })

                console.log('\n============================')
                console.log(qrBase64)
                console.log('============================\n')
            }

            if (connection === 'open') {

                reconectando = false

                console.log('\nWhatsApp conectado!\n')

                if (!sistemaIniciado) {

                    sistemaIniciado = true

                    iniciarSistema(sock)
                }
            }

            if (connection === 'close') {

                reconectando = false

                const shouldReconnect =
                    lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

                console.log('\nConexão fechada\n')

                if (shouldReconnect) {

                    console.log('Reconectando em 5 segundos...\n')

                    setTimeout(() => {
                        conectarWhatsApp()
                    }, 5000)
                }
            }
        })

    } catch (err) {

        reconectando = false

        console.log('Erro geral:', err)

        setTimeout(() => {
            conectarWhatsApp()
        }, 5000)
    }
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

    try {

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

        for (let i = 1; i < rows.length; i++) {

            const data = rows[i][0]
            const nome = rows[i][1]
            const funcao = rows[i][2]
            const telefone = rows[i][3]

            if (data === hoje) {

                encontrouEscala = true

                const mensagem = `Olá ${nome}!

Essa é uma mensagem automática para ajudar a lembrar que você está escalado hoje 🙏

Qualquer coisa me chama aqui!

Função: ${funcao}

Deus abençoe!`

                const numero = telefone + '@s.whatsapp.net'

                await sock.sendMessage(numero, {
                    text: mensagem
                })

                console.log(`Mensagem enviada para ${nome}`)
            }
        }

        if (!encontrouEscala) {

            console.log('Nenhuma escala encontrada para hoje.\n')
        }

    } catch (err) {

        console.log('Erro ao verificar escalas:', err)
    }
}

conectarWhatsApp()