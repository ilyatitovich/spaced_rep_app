import { test, expect } from '../../fixtures.js'
import {
  addTwoSidedCard,
  completeTodaysTestCorrect,
  createTopicFromHome
} from '../../helpers/journeys.js'

test.describe('guest study', () => {
  test('create topic, save level-1 card, grade Correct, Test control gone', async ({
    page
  }) => {
    const title = `Guest study ${Date.now()}`

    await page.goto('/')
    await createTopicFromHome(page, title)
    await addTwoSidedCard(page, 'capital of France', 'Paris')
    await expect(
      page.getByRole('button', { name: /Today’s Test/ })
    ).toBeVisible()

    await completeTodaysTestCorrect(page)

    await expect(
      page.getByRole('button', { name: /Today’s Test/ })
    ).toHaveCount(0)
  })
})
