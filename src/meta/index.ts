export type Prim = number | string | boolean

type CreditCardNumberValue = string & { __brand: 'CreditCardNumber' }

function creditCardNumberValue(s: string): CreditCardNumberValue {
  if (s.length > 12) throw new TypeError('too long')
  if (s.length < 8)  throw new TypeError('too short')
  return s as CreditCardNumberValue;
}

type CreditCardNumber = ReturnType<typeof creditCardNumberValue>

function test(cc: CreditCardNumber) {

}

test(creditCardNumberValue("helloooo00"))
