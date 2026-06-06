import { NOT_AVAILABLE, pushToDataLayer } from '../../utils'
import type { UserData } from '../../typings/events'

const userAuthenticated = (data: UserData) => {
    pushToDataLayer({
        event: 'virtualEvent',
        portal: 'Aruma',
        subportal: 'Home',
        seccion: 'Registro',
        subseccion: 'Iniciar sesión',
        intencion: 'Inicio exitoso',
        accion: 'Inicio exitoso',
        elemento: 'Modal',
        cta: 'Inicio exitoso',
    })

    pushToDataLayer({
        event: 'userProperties',
        userID: data.document || NOT_AVAILABLE,
        correo: data.email || NOT_AVAILABLE,
        edadUsuario: NOT_AVAILABLE,
        magentaUser: NOT_AVAILABLE,
        magentaPointsUser: NOT_AVAILABLE,
    })
}

export { userAuthenticated }
