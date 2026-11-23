/**
 * `data/detector.bin` 的编解码。
 *
 * 移植自 Ikaleio/lm-detector 的 `shared/detector-codec.ts`（MIT，见 NOTICE）。
 * 布局：小端 u32 头长度 | UTF-8 JSON 头 | 对齐填充 | 按字节位置分组的 float32。
 * JSON 头里每个纯数字数组写成 `{"$f32":offset,"n":length}`。
 */

/** @param {object} artifact 冻结的检测器对象 @returns {Uint8Array} */
export function encodeDetector(artifact) {
  /** @type {number[]} */
  const values = []
  const header = new TextEncoder().encode(JSON.stringify(artifact, (_, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('检测器参数必须是有限数')
    if (Array.isArray(value) && value.length && value.every(item => typeof item === 'number')) {
      const offset = values.length
      for (const item of value) {
        if (!Number.isFinite(Math.fround(item))) throw new Error('检测器参数超出 float32 范围')
        values.push(item)
      }
      return { $f32: offset, n: value.length }
    }
    return value
  }))
  const start = Math.ceil((4 + header.length) / 4) * 4
  const output = new Uint8Array(start + values.length * 4)
  const view = new DataView(output.buffer)
  view.setUint32(0, header.length, true)
  output.set(header, 4)
  const float = new DataView(new ArrayBuffer(4))
  values.forEach((value, i) => {
    float.setFloat32(0, value, true)
    for (let byte = 0; byte < 4; byte++) output[start + byte * values.length + i] = float.getUint8(byte)
  })
  return output
}

/** @param {Uint8Array} data @returns {any} 冻结的检测器对象 */
export function decodeDetector(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const headerLength = view.getUint32(0, true)
  const start = Math.ceil((4 + headerLength) / 4) * 4
  const count = (data.length - start) / 4
  const raw = new Uint8Array(count * 4)
  for (let i = 0; i < count; i++) for (let b = 0; b < 4; b++) raw[i * 4 + b] = data[start + b * count + i]
  const little = new DataView(raw.buffer)
  const floats = new Float32Array(count)
  for (let i = 0; i < count; i++) floats[i] = little.getFloat32(i * 4, true)
  return JSON.parse(new TextDecoder().decode(data.subarray(4, 4 + headerLength)), (_, value) =>
    value && typeof value === 'object' && '$f32' in value
      ? Array.from(floats.subarray(value.$f32, value.$f32 + value.n))
      : value)
}