import {strategyGraph} from './strategies';
import {simulate,emptyRuntime} from '../packages/simulation';
import {BASE_WORLD} from '../packages/content/catalog';
const world={...BASE_WORLD,reads:1400,writes:140,paymentMs:1200,paymentError:.08,attack:250,hot:.3,updateRate:.04,budget:1800};
for(const strategy of ['lean','replicated','async'] as const){let runtime=emptyRuntime();let result;for(let i=0;i<3;i++){result=simulate(strategyGraph(strategy),world,runtime,'same-window');runtime=result.runtime;}console.log(strategy,JSON.stringify(result!.telemetry));}
