
import has from 'just-has'
// https://anguscroll.com/just/just-replace-all
import replaceAll from 'just-replace-all'

import {
    getAppType
} from './app-derived.js'
import { buildVideoStructuredData } from './structured-data.js'
import { nuxtHead } from '~/helpers/config-node.js'
import {
    getPartPartsFromUrl
} from './url.js'


export const samChannelId = 'UCB3jOb5QVjX7lYecvyCoTqQ'

function makeTitle ( listing ) {
    return `Does ${ listing.name } work on Apple Silicon? - ${ nuxtHead.title }`
}

function makeDescription ( listing ) {
    // const processorsVerbiage = process.env.npm_package_config_verbiage_processors || this.$config.processorsVerbiage

    const processorsVerbiage = 'Apple M3 Max and M2 Ultra'

    return `Latest reported support status of ${ listing.name } on Apple Silicon and ${ processorsVerbiage } Processors.`
}

function convertYoutubeImageUrl ( stringWithUrls, extension ) {
    let workingString = stringWithUrls

    workingString = replaceAll( stringWithUrls, 'ytimg.com/vi/', `ytimg.com/vi_${ extension }/`)

    workingString = workingString.replace(/.png|.jpg|.jpeg/g, `.${ extension }`)

    return workingString
}

export function getVideoImages ( video ) {

    // Catch the case where the video has no thumbnails
    if ( !has( video, 'thumbnail' ) ) throw new Error('No thumbnail found')

    const webpSource = {
        ...video.thumbnail,
        srcset: convertYoutubeImageUrl( video.thumbnail.srcset, 'webp' ),
        src: convertYoutubeImageUrl( video.thumbnail.src, 'webp' ),
        type: 'image/webp'
    }

    const jpgSource = {
        ...video.thumbnail,
        type: 'image/jpeg'
    }

    const sources = {
        webp: webpSource,
        jpeg: jpgSource
    }

    // Responsive Preloads - https://web.dev/preload-responsive-images/
    // Responsive Preloads with image types - https://blog.laurenashpole.com/post/658079409151016960/preloading-images-in-a-responsive-webp-world
    // <link rel="preload" as="image" href="large-image.webp" media="(min-width: 768px)" imagesrcset="large-image.webp, large-image-2x.webp 2x" type="image/webp" />
    const preloads = Object.entries( sources ).map( ([ typeKey, typeSource ]) => {
        return {
            'rel': 'preload',
            'as': 'image',
            'href': typeSource.src,
            'media': typeSource.sizes,
            'imagesrcset': typeSource.srcset,
            'type': typeSource.type
        }
    })

    return {
        imgSrc: video.thumbnail.src,
        sources,
        preloads
    }
}

export function makeApiPathFromEndpoint ( endpoint ) {
    const [
        kind,
        listingSlug
    ] = getPartPartsFromUrl( endpoint )

    return `/api/${ kind }/${ listingSlug }.json`
}
export class ListingDetails {
    constructor ( listing ) {
        this.api = listing

        this.type = getAppType( listing )
    }

    type = ''

    get isGame () {
        return this.type === 'game'
    }

    isListingDetails = true

    get mainHeading () {
        // Use the video title for videos
        if ( this.type === 'video' ) {
            return this.api.name
        }

        if ( this.type === 'formula' ) {
            return `Does <code class="bg-darkest rounded px-2 py-1">${ this.api.name }</code> work on Apple Silicon when installed via Homebrew?`
        }

        return `Does ${ this.api.name } work on Apple Silicon?`
    }

    get subtitle () {
        return this.api.text
    }

    get pageTitle () {
        return makeTitle( this.api )
    }

    get pageDescription () {
        return makeDescription( this.api )
    }

    get endpointParts () {
        return getPartPartsFromUrl( this.api.endpoint )
    }

    get apiEndpointPath () {
        return makeApiPathFromEndpoint( this.api.endpoint )
    }

    get relatedVideos () {
        if ( Array.isArray( this.api.relatedVideos ) ) {
            return this.api.relatedVideos
        }

        if ( !!this.api.payload && Array.isArray( this.api.payload.relatedVideos ) ) {
            return this.api.payload.relatedVideos
        }

        return []
    }

    get hasRelatedVideos () {
        return this.relatedVideos.length > 0
    }

    get hasRelatedApps () {
        return Array.isArray( this.api.appLinks ) && this.api.appLinks.length > 0
    }

    get hasBenchmarksPage () {
        return this.hasRelatedVideos
    }

    get shouldHaveSubscribeButton () {
        if ( this.initialVideo === null ) return false

        return this.initialVideo.channel.id !== samChannelId
    }

    get initialVideo () {
        if ( this.type === 'video' ) {
            return this.api
        }

        if ( this.hasRelatedVideos ) {
            return this.api.relatedVideos[0]
        }

        return null
    }

    get hasInitialVideo () {
        return this.initialVideo !== null
    }

    get structuredData () {
        // Normal video page with app links
        if ( this.type === 'video' ) {
            return buildVideoStructuredData( this.api, this.api.appLinks )
        }

        // Benchmark page
        if ( this.hasInitialVideo ) {
            // Build app links with just the current app
            const appLinks =  [ {
                name: this.api.name,
                endpoint: this.api.endpoint
            } ]

            return buildVideoStructuredData( this.initialVideo, appLinks )
        }

        return null
    }

    get headOptions () {
        return {
            title: this.pageTitle,
            description: this.pageDescription,
            // meta,
            link: [],
            structuredData: this.structuredData,

            // domain,
            pathname: this.api.endpoint,
        }
    }
}


export function ensureListingDetails ( listing ) {
    if ( listing.isListingDetails ) {
        return listing
    }

    return new ListingDetails( listing )
}
