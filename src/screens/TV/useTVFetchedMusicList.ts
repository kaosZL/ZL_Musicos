import { useEffect, useState } from 'react'
import { LIST_IDS } from '@/config/constant'
import { getListMusics } from '@/core/list'

export const useTVFetchedMusicList = () => {
  const [list, setList] = useState<LX.List.ListMusics>([])

  useEffect(() => {
    let mounted = true
    const refresh = () => {
      void getListMusics(LIST_IDS.TEMP).then((musicList) => {
        if (!mounted) return
        setList([...musicList])
      })
    }
    const handleListUpdate = (ids: string[]) => {
      if (!ids.includes(LIST_IDS.TEMP)) return
      refresh()
    }

    refresh()
    global.app_event.on('myListMusicUpdate', handleListUpdate)
    return () => {
      mounted = false
      global.app_event.off('myListMusicUpdate', handleListUpdate)
    }
  }, [])

  return list
}
