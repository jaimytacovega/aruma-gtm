import { canUseDOM } from 'vtex.render-runtime'

import { pushToDataLayer } from '../../utils'


const LOGIN_MODAL_SELECTOR =
  '[class*="aruma-login-0-x-emailAndPasswordForm"]'
const LOGIN_MODAL_PAGE_TITLE = 'Aruma - Inicio sesion'

let observerAttached = false
let modalWasVisible = false

const isLoginModalVisible = (): HTMLElement | null => {
  const modal = document.querySelector(LOGIN_MODAL_SELECTOR)

  if (!(modal instanceof HTMLElement)) {
    return null
  }

  const { height, width } = modal.getBoundingClientRect()

  if (height === 0 || width === 0) {
    return null
  }

  return modal
}

const pushLoginVirtualPage = () => {
  pushToDataLayer({
    event: 'virtualPage',
    page_location: window.location.href,
    page_title: LOGIN_MODAL_PAGE_TITLE,
  })
}

const syncLoginModalTracking = () => {
  const modal = isLoginModalVisible()

  if (modal && !modalWasVisible) {
    modalWasVisible = true
    pushLoginVirtualPage()
    return
  }

  if (!modal && modalWasVisible) {
    modalWasVisible = false
  }
}

const registerLoginModal = () => {
  if (!canUseDOM || observerAttached) {
    return
  }

  const observer = new MutationObserver(() => {
    syncLoginModalTracking()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  observerAttached = true
  syncLoginModalTracking()
}

export { registerLoginModal }
