<script setup vapor>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({ period: Number, now: Number })
const stroke = ref()
const element = ref()
const path = ref('')
let observer
const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
let animation

function measure() {
    const { width, height } = element.value.getBoundingClientRect()
    const inset = .75
    const radius = Math.max(0, (height - inset * 2) / 2)
    const left = inset + radius, right = width - inset - radius, bottom = height - inset
    // Begin at twelve o'clock; circular end caps preserve an even perimeter speed.
    path.value = `M ${width / 2} ${inset} H ${right} A ${radius} ${radius} 0 0 1 ${right} ${bottom} H ${left} A ${radius} ${radius} 0 0 1 ${left} ${inset} Z`
}
function synchronize() {
    if (!stroke.value) return
    animation?.cancel()
    const duration = props.period * 1000
    const elapsed = Date.now() % duration
    // pathLength normalizes the actual capsule perimeter, so corners and straight edges run at the same speed.
    if (motion.matches) {
        stroke.value.style.strokeDashoffset = elapsed / duration
        return
    }
    stroke.value.style.removeProperty('stroke-dashoffset')
    const fade = Math.min(160 / duration, .15)
    animation = stroke.value.animate([
        { strokeDashoffset: 0, opacity: 0, offset: 0 },
        { strokeDashoffset: fade, opacity: 1, offset: fade },
        { strokeDashoffset: 1 - fade, opacity: 1, offset: 1 - fade },
        { strokeDashoffset: 1, opacity: 0, offset: 1 },
    ], { duration, iterations: Infinity, easing: 'linear' })
    animation.currentTime = elapsed
}
function onVisibility() { if (!document.hidden) synchronize() }
watch(() => props.period, synchronize)
watch(() => props.now, () => { if (motion.matches) synchronize() })
onMounted(() => {
    measure()
    synchronize()
    observer = new ResizeObserver(measure)
    observer.observe(element.value)
    document.addEventListener('visibilitychange', onVisibility)
    motion.addEventListener('change', synchronize)
})
onBeforeUnmount(() => {
    animation?.cancel()
    observer?.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    motion.removeEventListener('change', synchronize)
})
</script>

<template>
    <svg ref="element" class="countdown-border" aria-hidden="true">
        <path class="border-track" :d="path" />
        <path ref="stroke" class="border-progress" :d="path" pathLength="1" />
    </svg>
</template>
