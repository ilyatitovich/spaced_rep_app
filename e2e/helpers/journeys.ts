import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Click without Playwright actionability (home layer can intercept after slides). */
async function domClick(locator: Locator): Promise<void> {
  await locator.evaluate((el: HTMLElement) => {
    el.click()
  })
}

/** Top-most Back control (stacked screens keep lower Back buttons mounted). */
function topBack(page: Page): Locator {
  return page.getByRole('button', { name: 'Back' }).last()
}

/**
 * Closed PWA / upgrade modals stay in the DOM; disable their hit targets so
 * home controls remain clickable in Chromium e2e.
 */
export async function clearModalHitTargets(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
      '[data-screen].fixed.inset-0'
    )) {
      // Only neutralize closed overlays; open screens must stay clickable.
      el.style.pointerEvents = el.inert ? 'none' : ''
    }
  })
}

/** Create a topic from the home screen and open its detail view. */
export async function createTopicFromHome(
  page: Page,
  title: string
): Promise<void> {
  await clearModalHitTargets(page)
  await domClick(page.getByRole('button', { name: 'Create topic' }))
  await page.getByLabel('Topic title').fill(title)
  await domClick(page.getByRole('button', { name: 'Save' }))
  await expect(page.getByText('Topic created!')).toBeVisible()
  await domClick(topBack(page))
  await expect
    .poll(() => new URL(page.url()).searchParams.has('create'))
    .toBe(false)
  await clearModalHitTargets(page)

  const topicButton = page.getByRole('button', {
    name: `Go to topic: ${title}`
  })
  await expect(topicButton).toHaveCount(1)
  const topicId = await topicButton.getAttribute('data-topic-id')
  if (!topicId) {
    throw new Error(`Missing data-topic-id for topic "${title}"`)
  }

  // FF/WebKit: programmatic click on the list row is flaky under leftover
  // create-sheet layers; open via URL after IDB write has committed.
  await page.goto(`/?topicId=${encodeURIComponent(topicId)}`)
  await clearModalHitTargets(page)
  await expect(page.getByRole('button', { name: 'Add Cards' })).toBeVisible()
}

/**
 * Add a two-sided level-1 card on the open topic screen.
 * TipTap uses contenteditable; Flip blurs the front so both sides register.
 */
export async function addTwoSidedCard(
  page: Page,
  front: string,
  back: string
): Promise<void> {
  await clearModalHitTargets(page)
  await domClick(page.getByRole('button', { name: 'Add Cards' }))
  await expect(page.getByText('Front', { exact: true })).toBeVisible()

  // 3D card faces can sit outside the layout viewport; focus instead of click.
  const frontEditor = page
    .locator(
      '.card-stage.scale-up .card-face:not(.card-face-back) .ProseMirror'
    )
    .first()
  await frontEditor.evaluate((el: HTMLElement) => el.focus())
  await page.keyboard.type(front)
  // Blur so cardData picks up the front before we edit the back.
  await frontEditor.evaluate((el: HTMLElement) => el.blur())

  await domClick(page.getByRole('button', { name: 'Flip' }))
  await expect(page.getByText('Back', { exact: true })).toBeVisible()
  const backEditor = page
    .locator('.card-stage.scale-up .card-face-back .ProseMirror')
    .first()
  await expect(backEditor).toBeAttached({ timeout: 5_000 })
  await backEditor.evaluate((el: HTMLElement) => el.focus())
  await page.keyboard.type(back)
  await backEditor.evaluate((el: HTMLElement) => el.blur())

  const done = page.getByRole('button', { name: 'Done', exact: true })
  if (await done.isVisible({ timeout: 500 }).catch(() => false)) {
    await domClick(done)
  }

  // Create-topic Save can stay mounted (disabled); use the top Add Card Save.
  const save = page.getByRole('button', { name: 'Save', exact: true }).last()
  await expect(save).toBeEnabled()
  await domClick(save)
  // Save is async; wait for the empty next-card draft before closing.
  await expect(
    page.getByRole('button', { name: 'Save Draft', exact: true })
  ).toBeVisible()
  await clearModalHitTargets(page)
  await domClick(topBack(page))
  await expect
    .poll(() => new URL(page.url()).searchParams.has('addCard'))
    .toBe(false)
}

/** Open today's test, reveal the answer, mark Correct, return to the topic. */
export async function completeTodaysTestCorrect(page: Page): Promise<void> {
  await clearModalHitTargets(page)
  await expect(page.getByRole('button', { name: /Today’s Test/ })).toBeVisible()
  await domClick(page.getByRole('button', { name: /Today’s Test/ }))
  await expect
    .poll(() => new URL(page.url()).searchParams.get('test'))
    .toBe('true')
  await expect(page.getByText('tap on card to reweal answer')).toBeVisible({
    timeout: 10_000
  })

  // Study flip listens for Space (when not focused on a control) or touch.
  await page.evaluate(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  })
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Correct' })).toBeVisible({
    timeout: 10_000
  })
  await domClick(page.getByRole('button', { name: 'Correct' }))
  await expect(page.getByText('All done!')).toBeVisible()

  await domClick(topBack(page))
}

export async function openAccountSettings(page: Page): Promise<void> {
  await clearModalHitTargets(page)
  await domClick(page.getByRole('button', { name: 'Account' }))
  await expect(page.getByText('Account', { exact: true })).toBeVisible()
}

export async function waitForTopicOnHome(
  page: Page,
  title: string,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 45_000
  await expect
    .poll(
      async () => {
        await page.reload()
        await clearModalHitTargets(page)
        await page.getByText('Topics', { exact: true }).waitFor()
        return page
          .getByRole('button', { name: `Go to topic: ${title}` })
          .count()
      },
      { timeout }
    )
    .toBeGreaterThan(0)
}

export async function waitForTopicGoneFromHome(
  page: Page,
  title: string,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 45_000
  await expect
    .poll(
      async () => {
        await page.reload()
        await clearModalHitTargets(page)
        await page.getByText('Topics', { exact: true }).waitFor()
        return page
          .getByRole('button', { name: `Go to topic: ${title}` })
          .count()
      },
      { timeout }
    )
    .toBe(0)
}

export { domClick, topBack }
