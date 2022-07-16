
import {
    // assert,
    expect,
    test
} from 'vitest'

import { createApp } from 'vue'


import AppFilesScanner from '~/helpers/app-files-scanner.js'

// import {
//     isString
// } from '~/helpers/check-types.js'

// const cases = [

// ]


function buildVueInstance () {
    return createApp({
        template: '<div>Hello World</div>',
        data: function () {
            return {
                appsBeingScanned: []
            }
        },
    })
}

test('Can initialize AppFilesScanner within Vite context', async () => {
    const vueInstance:any = buildVueInstance()

    const scanner = new AppFilesScanner({
        observableFilesArray: vueInstance.appsBeingScanned,
        testResultStore: global.$config.testResultStore
    })

    // Expect the scanner to be an instance of AppFilesScanner
    expect( scanner ).toBeInstanceOf( AppFilesScanner )

})