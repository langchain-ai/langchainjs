import { assertType } from 'vitest'
import { OpenAITranscriptions } from './index.js'

import type { VerboseTranscriptionResponse, BaseTranscriptionResponse } from './types.js'

const audio = new Uint8Array([0x4f, 0x67, 0x67, 0x53])

test('validates response formats', async () => {
    const transcriber = new OpenAITranscriptions({
        model: 'whisper-1',
        response_format: 'json',
    })
    assertType<BaseTranscriptionResponse>(await transcriber.transcribe({
        audio,
        options: {
            response_format: 'text',
        }
    }))
    assertType<VerboseTranscriptionResponse>(await transcriber.transcribe({
        audio,
        options: {
            response_format: 'verbose_json',
        }
    }))

    const transcriber1 = new OpenAITranscriptions({
        model: 'gpt-4o-mini-transcribe',
        response_format: 'json',
    })
    assertType<BaseTranscriptionResponse>(await transcriber1.transcribe({
        audio,
        options: {
            response_format: 'text',
        }
    }))
    await transcriber1.transcribe({
        audio,
        options: {
            // @ts-expect-error this is not allowed
            response_format: 'verbose_json',
        }
    })


    const transcriber2 = new OpenAITranscriptions({
        model: 'gpt-4o-transcribe',
        response_format: 'text',
    })
    assertType<BaseTranscriptionResponse>(await transcriber2.transcribe({
        audio,
        options: {
            response_format: 'json',
        }
    }))
    await transcriber2.transcribe({
        audio,
        options: {
            // @ts-expect-error this is not allowed
            response_format: 'verbose_json',
        }
    })
})