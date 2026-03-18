/**
 * Expanded blocklist of disposable/temporary email providers.
 * Used by validateEmail() in security.ts to reject throwaway signups.
 * Stored as a Set for O(1) lookup.
 */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // Major disposable providers
  'tempmail.com',
  'throwaway.email',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamailblock.com',
  'grr.la',
  'mailinator.com',
  'yopmail.com',
  'yopmail.fr',
  'sharklasers.com',
  'guerrillamail.info',
  'guerrillamail.net',

  // Popular temp mail services
  'temp-mail.org',
  'tempail.com',
  'tempmailaddress.com',
  'tmpmail.net',
  'tmpmail.org',
  'tempinbox.com',
  'dispostable.com',
  'maildrop.cc',
  'mailnesia.com',
  'mailcatch.com',
  'mailsac.com',

  // Trash / disposable
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'trashmails.com',
  'trashymail.com',
  'trashymail.net',

  // 10-minute / temporary
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '10mail.org',
  '20minutemail.com',
  'minutemail.com',

  // Fake / anonymous
  'fakeinbox.com',
  'fakemail.fr',
  'fakemailgenerator.com',
  'anonymbox.com',
  'anonbox.net',
  'mytrashmail.com',
  'mailexpire.com',
  'mailmoat.com',
  'mailnull.com',
  'mailshell.com',

  // Spam-oriented
  'spam4.me',
  'spamfree24.org',
  'spamgourmet.com',
  'spamgourmet.net',
  'spamspot.com',
  'bugmenot.com',

  // Pokemail / GuerrillaMail variants
  'pokemail.net',
  'getairmail.com',
  'filzmail.com',

  // Other well-known disposable providers
  'cuvox.de',
  'dayrep.com',
  'einrot.com',
  'fleckens.hu',
  'gustr.com',
  'harakirimail.com',
  'jetable.org',
  'jourrapide.com',
  'klassmaster.com',
  'lroid.com',
  'maileater.com',
  'mailforspam.com',
  'mailfreeonline.com',
  'mailimate.com',
  'mailscrap.com',
  'meltmail.com',
  'mintemail.com',
  'mt2015.com',
  'nobulk.com',
  'nospam.ze.tc',
  'owlpic.com',
  'proxymail.eu',
  'rcpt.at',
  'reallymymail.com',
  'rhyta.com',
  'superrito.com',
  'tittbit.in',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'wh4f.org',
  'yolanda.dev',
]);
