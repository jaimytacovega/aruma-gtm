import { log } from '../../utils'
import type { AddToWishlistData } from '../../typings/events'

const addToWishlist = (data: AddToWishlistData) => {
    log('vtex:addToWishlist', data)
}

export { addToWishlist }
