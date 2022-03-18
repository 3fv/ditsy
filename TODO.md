# TODO

## FEATURES: Container modifications

- [ ] Create `inject` on `Container`
  - [ ] Modify `@Inject` to recognize member properties as well as the current parameters 
  - [ ] Add new function`Container.inject<T>(instance: T): T`, which populates any annotated but unpopulated values

 
- [ ] Create `match` & `matchAll` on `Container`
  - [ ] Add `match` function to `Container`
    Matching can be `regex`, `string`, `symbol`, `constructor`
  - [ ] `regex` will match `InjectableId` (`string` or `symbol`) via `test`,
    `constructor` is sort of *hackish*, but will get the `constructor` name
    and that to the testable list
  - [ ] Create a new decorator `@InjectMatch` which uses the above
    injects `T | undefined`
  - [ ] Create a new decorator `@InjectMatchAll` which uses the above
    injects `T[]`


