import { createApp } from 'vue'
import '../styles/theme.css'
import { initThemePicker } from '../lib/theme'
import '../styles/mcp.css'
import App from '../components/McpServersApp.vue'

createApp(App).mount('#app')

initThemePicker(document.querySelector<HTMLElement>('[data-theme-picker]'))
