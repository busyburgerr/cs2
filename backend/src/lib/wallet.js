/**
 * Демо-аккаунты играют на отдельном виртуальном балансе.
 * Реальные деньги и демо-деньги нигде не смешиваются: поле выбирается
 * по флагу аккаунта, а каждая запись игры помечается demo.
 */
export const balanceField = (user) => (user.demo ? 'demoBalance' : 'balance')

export const balanceOf = (user) => (user.demo ? user.demoBalance : user.balance)

/** Пополнение/списание нужного баланса в prisma-транзакции. */
export const changeBalance = (user, delta) => ({
  [balanceField(user)]: delta < 0 ? { decrement: -delta } : { increment: delta },
})
