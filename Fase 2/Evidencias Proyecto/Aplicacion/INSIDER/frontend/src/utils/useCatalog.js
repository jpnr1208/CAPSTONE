import { useEffect, useState } from 'react'
import api from '../api/client'

let cache = null

export default function useCatalog() {
  const [catalog, setCatalog] = useState(cache)
  useEffect(() => {
    if (cache) return
    api.get('/catalog/').then(({ data }) => { cache = data; setCatalog(data) }).catch(() => {})
  }, [])
  return catalog
}
