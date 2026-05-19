import { pushToDataLayer } from '../../utils'


const homeHeaderGeneralOptions = (target: Element, className: string) => {
    const container = target.closest(`[class*="${className}"]`)
    if (!container || !(container instanceof HTMLElement)) return

    const cta = className.includes('header-magenta-button')
        ? 'Magenta Points'
        : container.querySelector(':is(p, p a)')?.textContent?.trim() || ''

    pushToDataLayer({
        event: 'virtualEvent',
        portal: 'Aruma',
        subportal: 'Home',
        seccion: 'Header',
        subseccion: 'Opciones generales',
        intencion: 'Seleccionar opciones generales',
        accion: 'Seleccionar elemento',
        elemento: 'Boton',
        cta,
    })
}

export {
    homeHeaderGeneralOptions,
}