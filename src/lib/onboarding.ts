export function isOnboardingComplete() {
  try {
    return localStorage.getItem('onboardingComplete') === 'true';
  } catch {
    return false;
  }
}

export function completeOnboarding() {
  try {
    localStorage.setItem('onboardingComplete', 'true');
  } catch {
    // ignore
  }
}