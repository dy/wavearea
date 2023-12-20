import { useSignal } from '@preact/signals'
import { useEffect } from 'preact/hooks'

export default function Loader() {
  const str = useSignal('')
  useEffect(() => {
    const id = setInterval(() => (str.value += '.'), 50)
    return () => {
      clearInterval(id)
    }
  })
  return <div class="w-loader" with="{str:''}">{str}</div>
}
