import logger from '../services/logger.js'
import ms from 'ms'
import { MODRINTH_USER_AGENT, LOADER_UPDATE_INTERVAL } from '../configs/constants.js'
import { update_versions } from '../models/serverVersionModel.js'
import { compare_versions } from '../utils.js'

export default async () => {
    const fetch_loaders = async () => {
        try {
            // const fetch_vanilla = async () => {
            //     const res = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', { headers: { 'User-Agent': MODRINTH_USER_AGENT } })
            //     const data = await res.json()
            //     const versions = data.versions
            //     .filter(version => version.type === 'release')
            //     .map(version => {
            //         return [version.id, {
            //             fabric: [],
            //             quilt: [],
            //             neoforge: [],
            //             forge: []
            //         }]
            //     })
            //     return Object.fromEntries(versions)
            // }

            const fetch_vanilla = async () => {
                const manifest_res = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', { 
                    headers: { 'User-Agent': MODRINTH_USER_AGENT } 
                })
                const manifest_data = await manifest_res.json()
                const releases = manifest_data.versions.filter(version => version.type === 'release')
                const mc_versions = {}
                let delay = 500
                for (const version_info of releases) {
                    let success = false
                    let version_data = null
                    while (!success) {
                        const res = await fetch(version_info.url, { 
                            headers: { 'User-Agent': MODRINTH_USER_AGENT } 
                        })

                        if (res.status === 429) {
                            await new Promise(resolve => setTimeout(resolve, delay))
                            delay = Math.min(delay * 2, 30000)
                            continue
                        }

                        version_data = await res.json()
                        success = true
                        delay = 500
                    }

                    if (version_data?.downloads?.server?.url) {
                        mc_versions[version_info.id] = {
                            fabric: [],
                            quilt: [],
                            neoforge: [],
                            forge: []
                        }
                    }
                }

                return mc_versions
            }

            const mc_versions = await fetch_vanilla()
            
            const fetch_fabric = async () => {
                let delay = 500
                for (const version of Object.keys(mc_versions)) {
                    await new Promise(resolve => setTimeout(resolve, delay))
                    const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${version}`, { headers: { 'User-Agent': MODRINTH_USER_AGENT } })
                    if (res.status === 429) {
                        delay *= 2
                        delay = Math.min(delay, 30000)
                        continue
                    }
                    const data = await res.json()
                    for (const loader of data) {
                        const loader_version = loader?.loader?.version
                        if (loader_version) mc_versions[version].fabric.push(loader_version)
                    }
                    mc_versions[version].fabric_main = mc_versions[version].fabric.find(v => !v.includes('+'))
                }
            }

            const fetch_quilt = async () => {
                let delay = 500
                for (const version of Object.keys(mc_versions)) {
                    await new Promise(resolve => setTimeout(resolve, delay))
                    const res = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${version}`, { headers: { 'User-Agent': MODRINTH_USER_AGENT } })
                    if (res.status === 429) {
                        delay *= 2
                        delay = Math.min(delay, 30000)
                        continue
                    }
                    const data = await res.json()
                    if (data?.code === "not_found") continue
                    for (const loader of data) {
                        const loader_version = loader?.loader?.version
                        if (loader_version) mc_versions[version].quilt.push(loader_version)
                    }
                    if (mc_versions[version].quilt.length > 0) {
                        mc_versions[version].quilt.sort(compare_versions).reverse()
                        mc_versions[version].quilt_main = mc_versions[version].quilt.find(v => !v.includes('-'))
                    }
                }
            }

            const fetch_neoforge = async () => {
                const res = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net%2Fneoforged%2Fneoforge', { headers: { 'User-Agent': MODRINTH_USER_AGENT } })
                const data = await res.json()
                for (const loader_version of data.versions) {
                    if (loader_version.toLowerCase().includes('craftmine')) continue
                    const match_target = "1." + loader_version
                    for (let i = match_target.length; i > 0; i--) {
                        const prefix = match_target.substring(0, i)
                        if (mc_versions[prefix]) {
                            mc_versions[prefix].neoforge.push(loader_version)
                            break
                        }
                    }
                }
                for (const mc_version in mc_versions) {
                    if (mc_versions[mc_version].neoforge.length > 0) {
                        mc_versions[mc_version].neoforge.reverse()
                        mc_versions[mc_version].neoforge_main = mc_versions[mc_version].neoforge.find(version => !version.includes('-'))
                    }
                }
            }

            const fetch_forge = async () => {
                const res = await fetch('https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json', { headers: { 'User-Agent': MODRINTH_USER_AGENT } })
                const data = await res.json()
                for (const [match_target, loader_version] of Object.entries(data.promos)) {
                    for (let i = match_target.length; i > 0; i--) {
                        const prefix = match_target.substring(0, i)
                        if (mc_versions[prefix]) {
                            mc_versions[prefix].forge.push(loader_version)
                            if (match_target.includes('recommended')) mc_versions[prefix].forge_main = loader_version
                            break
                        }
                    }
                }
                for (const mc_version in mc_versions) {
                    if (mc_versions[mc_version].forge.length > 0) {
                        mc_versions[mc_version].forge.sort(compare_versions).reverse()
                        if (mc_versions[mc_version].forge_main === undefined) {
                            mc_versions[mc_version].forge_main = mc_versions[mc_version].forge[0]
                        }
                    }
                }
            }

            await Promise.all([
                fetch_fabric(),
                fetch_quilt(),
                fetch_neoforge(),
                fetch_forge()
            ])

            await update_versions(mc_versions)
        } catch (error) {
            logger.error(error, 'Error fetching loaders')
        } finally {
            setTimeout(fetch_loaders, ms(LOADER_UPDATE_INTERVAL))
        }
    }

    await fetch_loaders()
}
