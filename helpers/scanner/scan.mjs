import { Buffer } from 'buffer/index.js'
import prettyBytes from 'pretty-bytes'
import * as zip from '@zip.js/zip.js'

import * as FileApi from './file-api.js'
import { isString, isNonEmptyString } from '../check-types.js'
import { parsePlistBuffer } from './parsers/plist.js'
import { extractMachoMeta } from './parsers/macho.js'

// https://gildas-lormeau.github.io/zip.js/core-api.html#configuration
zip.configure({
    // Disable Web Workers for SSR since Node doesn't support them yet
    // https://vitejs.dev/guide/env-and-mode.html#env-variables
    useWebWorkers: !import.meta.env.SSR
})


function makeNodeFileBuffer ( buffer ) {
    const fileBuffer = new Buffer.alloc( buffer.byteLength )

    for (var i = 0; i < buffer.length; i++)
        fileBuffer[i] = buffer[i];

    // console.log( 'this.machoFileInstance', this.machoFileInstance.buffer.byteLength )

    return fileBuffer
}

export class AppScan {
    constructor ({
        fileLoader,
        messageReceiver
    }) {

        this.fileLoader = fileLoader
        this.messageReceiver = messageReceiver

        this.status = 'idle'
        this.file = null
        this.bundleFileEntries = []
        this.infoPlist = {}
        this.machoExcutables = []

        // Data that is derived after we've read the files and pulled out the infoPlist
        this.appVersion = ''
        this.displayName = ''
        this.details = []
        this.bundleExecutable = null
        this.displayBinarySize = ''
        this.binarySize = 0
        this.machoMeta = {}
        this.binarySupportsNative = undefined

        this.info = {}
    }

    sendMessage ( details ) {
        if ( details?.status ) {
            this.status = details.status
        }

        if ( typeof( this.messageReceiver ) === 'function' ) {
            this.messageReceiver( details )
        }
    }

    get hasInfoPlist () {
        return Object.keys( this.infoPlist ).length > 0
    }

    get hasMachoMeta () {
        return Object.keys( this.machoMeta ).length > 0
    }

    get hasInfo () {
        return Object.keys( this.info ).length > 0
    }

    get bundleExecutablePath () {
        if ( !this.hasInfoPlist ) return ''

        // There our CFBundleExecutable is a path to the executable
        // then use it
        if ( this.infoPlist.CFBundleExecutable.includes('/') ) return `/Contents/${ this.infoPlist.CFBundleExecutable }`

        // Use default executable path
        return `/Contents/MacOS/${ this.infoPlist.CFBundleExecutable }`
    }

    get supportedArchitectures () {
        if ( !this.hasMachoMeta ) return []

        return this.machoMeta.architectures.filter( architecture => architecture.processorType !== 0 )
    }

    async readFileEntryData ( fileEntry, Writer = zip.TextWriter ) {
        // Get blob data from zip
        // https://gildas-lormeau.github.io/zip.js/core-api.html#zip-entry
        return await fileEntry.getData(
            // writer
            // https://gildas-lormeau.github.io/zip.js/core-api.html#zip-writing
            new Writer()//zip.TextWriter(),
        )
    }

    async loadFile () {
        // If fileLoader is no a function
        // then try to load the file
        if ( typeof( this.fileLoader ) !== 'function' ) {
            return this.fileLoader
        }

        const file = this.fileLoader()

        // Check if our file is a Promise
        // if it is then await it
        if ( file instanceof Promise || typeof file?.then === 'function' ) {
            return await file
        }

        return file
    }

    getZipFileReader ( FileInstance ) {
        // Check if file is a Blob, typically in the Browser
        // otherwise convert it to a Blob, like in Node
        // Both Browser and Node have Blob
        // Node/Our File Polyfill references .arrayBuffer as a property
        // Browser currently references .arrayBuffer as an async method
        if ( FileInstance instanceof Blob ) {
            return new zip.BlobReader( FileInstance )
        }

        if ( FileInstance instanceof ArrayBuffer ) {
            return new zip.Uint8ArrayReader( FileInstance )
        }

        // return new zip.Uint8ArrayReader( new Uint8Array( FileInstance.arrayBuffer ) )
        // const FileBlob = FileInstance instanceof Blob ? FileInstance : new Blob( FileInstance.arrayBuffer )

        throw new Error( 'FileInstance is not a known format' )
    }

    async readFileBlob ( FileInstance ) {
        return new Promise( async ( resolve, reject ) => {

            console.log( 'FileInstance', FileInstance )

            const binaryReader = this.getZipFileReader( FileInstance ) //new zip.BlobReader( FileBlob )

            // https://gildas-lormeau.github.io/zip.js/core-api.html#zip-reading
            const zipReader = new zip.ZipReader( binaryReader )

            zipReader
                .getEntries()
                .then( entries => {

                    // do something on entries
                    this.sendMessage({
                        message: '📖 Reading file complete. Entries found',
                        status: 'read'
                    })

                    resolve( entries )
                })
                .catch( error => {
                    reject( error )
                })

        })
    }

    classifyBinaryEntryArchitecture ( binaryEntry ) {
        // Find an ARM Architecture
        const armArchitecture = binaryEntry.architectures.find( architecture => {
            // if ( architecture.processorType === 0 ) return false

            // If processorType not a string
            // then return false
            if ( !isString(architecture.processorType) ) return false

            return architecture.processorType.toLowerCase().includes('arm')
        })

        // Was an ARM Architecture found
        return (armArchitecture !== undefined)
    }

    matchesMachoExecutable ( entry ) {
        // Skip files that are deeper than 3 folders
        if ( entry.filename.split('/').length > 4 ) return false

        // Skip folders
        // if ( !!entry.directory ) return false

        // `${ appName }.app/Contents/MacOS/${ appName }`
        // Does this entry path match any of our wanted paths
        return [
            // `${ appName }.app/Contents/MacOS/${ appName }`
            // `.app/Contents/MacOS/`,
            `Contents/MacOS/`
        ].some( pathToMatch => {
            return entry.filename.includes( pathToMatch )
        })
    }

    matchesRootInfoPlist ( entry ) {
        // Skip files that are deeper than 2 folders
        if ( entry.filename.split('/').length > 3 ) return false

        // Skip folders
        if ( entry.filename.endsWith('/') ) return false

        // If this entry matches the root info.plist path exactly
        // then we have found the root info.plist
        if ( entry.filename === 'Contents/Info.plist' ) return true

        // Does this entry path match any of our wanted paths
        return [
            // `zoom.us.app/Contents/Info.plist`
            `.app/Contents/Info.plist`,
            `.zip/Contents/Info.plist`
        ].some( pathToMatch => {
            return entry.filename.endsWith( pathToMatch )
        })
    }

    fileEntryType ( fileEntry ) {
        if ( !!fileEntry.directory ) return 'directory'

        if ( this.matchesMachoExecutable( fileEntry ) ) return 'machoExecutable'

        if ( this.matchesRootInfoPlist( fileEntry ) ) return 'rootInfoPlist'

        // getData

        return 'unknown'
    }

    storeInfoPlist = async ( fileEntry ) => {
        // Throw if we have more than one target file
        if ( this.hasInfoPlist ) {
            throw new Error( 'More than one root info.plist found' )
        }

        const infoUint8Array = await this.readFileEntryData( fileEntry, zip.Uint8ArrayWriter )
        // console.log( 'infoUint8Array', infoUint8Array )

        const infoNodeBuffer = makeNodeFileBuffer( infoUint8Array )

        // Parse the Info.plist data
        this.infoPlist = await parsePlistBuffer( infoNodeBuffer )

        this.sendMessage({
            message: 'ℹ️ Found Info.plist',
            // data: this.infoPlist
        })
    }

    storeMachoExecutable = ( fileEntry ) => {
        this.machoExcutables.push( fileEntry )

        this.sendMessage({
            message: '🥊 Found a Macho executable',
            // data: machoExecutable,
        })
    }

    storeResultInfo () {
        this.info = {
            filename: this.file.name,
            appVersion: this.appVersion,
            result: this.binarySupportsNative ? '✅' : '🔶',
            machoMeta: {
                ...this.machoMeta,
                file: undefined,
                architectures: this.machoMeta.architectures.map( architecture => {
                    return {
                        bits: architecture.bits,
                        fileType: architecture.fileType,
                        header: architecture.header,
                        loadCommandsInfo: architecture.loadCommandsInfo,
                        magic: architecture.magic,
                        offset: architecture.offset,
                        processorSubType: architecture.processorSubType,
                        processorType: architecture.processorType,
                    }
                })
            },
            infoPlist: this.infoPlist,
        }
    }

    storeMachoMeta = async ( fileEntry ) => {
        // Throw if we have more than one target file
        if ( this.hasMachoMeta ) {
            throw new Error( 'More than one primary Macho executable found' )
        }

        // Get zip as Uint8Array
        const bundleExecutableUint8Array = await this.readFileEntryData( fileEntry, zip.Uint8ArrayWriter )

        const machoFileInstance = new FileApi.File({
            name: this.bundleExecutable.filename,
            type: 'application/x-mach-binary',
            buffer: Buffer.from( bundleExecutableUint8Array )
        })

        // Get zip as blob
        // so we can use it in for the File API when we're in the browser context
        // https://gildas-lormeau.github.io/zip.js/core-api.html#zip-entry
        machoFileInstance.blob = await this.readFileEntryData( fileEntry, zip.BlobWriter )

        this.machoMeta = await extractMachoMeta({
            machoFileInstance,
            FileApi
        })

        // console.log( 'this.machoMeta', this.machoMeta )

    }


    targetFiles = {
        rootInfoPlist: {
            method: this.storeInfoPlist
        },
        machoExecutable: {
            method: this.storeMachoExecutable,
        }
    }

    findMainExecutable () {

        // Now that we have the info.plist Determine our entry Macho Executable from the list of Macho Executables
        const bundleExecutables = this.machoExcutables.filter( machoEntry => {

            if ( machoEntry.filename.includes( this.bundleExecutablePath ) ) {
                return true
            }

            return this.bundleExecutablePath.includes( machoEntry.filename )
        })

        // Warn if Bundle Executable doesn't look right
        if ( bundleExecutables.length > 1) {
            throw new Error('More than one root bundleExecutable found', bundleExecutables)
        } else if ( bundleExecutables.length === 0 ) {
            throw new Error('No root bundleExecutable found', bundleExecutables)
        }

        return bundleExecutables[ 0 ]
    }

    async findTargetFiles () {

        for ( const fileEntry of this.bundleFileEntries ) {
            const type = this.fileEntryType( fileEntry )

            // console.log( 'fileEntry', type, fileEntry.filename )

            // Check if we have a target file
            if ( this.targetFiles[ type ] ) {
                // console.log( 'fileEntry', type, fileEntry.filename )

                // Call the target file method
                await this.targetFiles[ type ].method( fileEntry )
            }

            // console.log( 'File Entry Type:', type )
        }

        // Now that we have the info.plist Determine our entry Macho Executable from the list of Macho Executables

        // Find valid app version that is a string but not empty
        this.appVersion = ([
            this.infoPlist.CFBundleShortVersionString,
            this.infoPlist.CFBundleVersion
        ]).find( isNonEmptyString )[0]

        // Find Display Name that is a string but not empty
        this.displayName = ([
            this.infoPlist.CFBundleDisplayName,
            this.infoPlist.CFBundleName,
            this.infoPlist.CFBundleExecutable,
        ]).find( isNonEmptyString )[0]

        // We loop through possible details and add them to the details array
        // if they are not empty
        ;([
            [ 'Version', this.infoPlist.CFBundleShortVersionString ],
            [ 'Bundle Identifier', this.infoPlist.CFBundleIdentifier ],
            [ 'File Mime Type', this.file.type ],
            [ 'Copyright', this.infoPlist.NSHumanReadableCopyright ],
            // [ 'Version', info.CFBundleShortVersionString ],
        ]).forEach( ([ label, value ]) => {
            if ( !value || value.length === 0 ) return

            this.details.push({
                label,
                value,
            })
        } )

        // Set the bundleExecutable
        this.bundleExecutable = this.findMainExecutable()

        console.log('Parsing ', this.bundleExecutable.filename, this.bundleExecutable.uncompressedSize / 1000 )

        this.displayBinarySize = prettyBytes( this.bundleExecutable.uncompressedSize )
        this.binarySize = this.bundleExecutable.uncompressedSize


        await this.storeMachoMeta( this.bundleExecutable )

        this.binarySupportsNative = this.classifyBinaryEntryArchitecture( this.machoMeta )
    }

    async runScan () {
        // Load in the file
        this.sendMessage({
            message: '🚛 Loading file...',
            status: 'loading'
        })


        this.file = await this.loadFile()

        this.sendMessage({
            message: '📚 Extracting from archive...',
            status: 'scanning',
            data: this.file
        })

        this.bundleFileEntries = await this.readFileBlob( this.file )

        this.sendMessage({
            message: '🎬 Starting scan',
            status: 'scanning'
        })

        await this.findTargetFiles()

        this.storeResultInfo()

        this.sendMessage({
            message: '🔎 Checking online for native versions...',
            status: 'checking'
        })

        // Sleep for 3 seconds
        // await new Promise( resolve => setTimeout( resolve, 3000 ) )

        this.sendMessage({
            message: '🏁 Scan complete! ',
            status: 'finished'
        })
    }

    async start () {

        try {

            await this.runScan()

        } catch ( error ) {
            this.sendMessage({
                message: '🚫 Error: ' + error.message,
                status: 'finished',
                error
            })
        }

    }
}
