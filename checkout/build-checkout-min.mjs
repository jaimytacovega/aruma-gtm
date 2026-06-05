/**
 * Merges checkout modules into checkout-ui-custom.min.js
 * Run from repo root: node checkout/build-checkout-min.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SOURCES = [
  '4_3__cartPickButtons.js',
  '5_1_1__checkoutScreening.js',
  'checkoutCartItems.js',
  'checkoutOrderFormUtils.js',
  '3_5__addToCart.js',
  '4_2__removeFromCart.js',
  '4_1__cartImpression.js',
  '5_1_2__startCheckout.js',
  '5_1_3__companyInfo.js',
  '5_1_4__submitCompanyInfo.js',
  '5_2_1__shippingScreening.js',
  '5_2_2__submitShipping.js',
  '5_2_3__shippingPickButton.js',
  '5_3_1__paymentScreening.js',
  '5_3_2__paymentInfo.js',
  '5_3_3__paymentPickButton.js',
  '5_4_1__successPaymentScreening.js',
  '5_4_2__successPayment.js',
  'checkout-ui-custom.js',
]

const stripLeadingFileComment = (code) =>
  code.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*/, '')

const merged = SOURCES.map((file) => {
  const path = join(__dirname, file)
  return stripLeadingFileComment(readFileSync(path, 'utf8')).trim()
}).join('\n')

const banner =
  '/*! aruma-gtm checkout bundle — AUTO-GENERATED. Edit source files, then: node checkout/build-checkout-min.mjs */\n'

let output = `${banner}${merged}\n`

try {
  output = execSync('npx --yes terser --compress --mangle --comments /^!/', {
    input: output,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  if (!output.startsWith('/*!')) {
    output = banner + output
  }
} catch {
  output = output.replace(/\n\s*\n/g, '\n').replace(/\/\/[^\n]*/g, '')
}

const outPath = join(__dirname, 'checkout-ui-custom.min.js')
writeFileSync(outPath, output, 'utf8')
console.info(`Wrote ${outPath} (${output.length} bytes)`)
