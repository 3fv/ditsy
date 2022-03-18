//import "source-map-support/register"
import "reflect-metadata"
import "jest"
import { Injectable, PostConstruct, Scope } from "../decorators"
import { Container } from "../container"
import { ErrorReason } from "../error"

describe("Async factories", () => {


  it("Should support delayed retrieval", async () => {
    class A {
      constructor(public c: number) {}
    }

    let requested: Date = null

    async function fetchA() {
      return new Promise<A>(resolve => {
        requested = new Date()
        setTimeout(() => {
          resolve(new A(1))
        }, 25)
      })
    }

    const container = new Container()
    container
      .bindAsyncFactory(A, async () => {
        return await fetchA()
      }, {
        scope: "singleton"
      })

    const a = await container.resolve(A)
    const end = new Date()

    expect(end.getTime() - requested.getTime()).toBeGreaterThanOrEqual(20)
    expect(a.c).toEqual(1)
  })

  it("Should support async initialization", async () => {
    class A {
      constructor(readonly c: number) {}
    }

    let requested: Date = null

    async function fetchA() {
      return new Promise<A>(resolve => {
        requested = new Date()
        setTimeout(() => {
          resolve(new A(1))
        }, 25)
      })
    }

    const container = new Container()
    container
      .bindAsyncFactory(A, async () => {
        return await fetchA()
      }, {
        scope: "singleton"
      })


    await container.whenReady()
    const end = new Date()

    expect(end.getTime() - requested.getTime()).toBeGreaterThanOrEqual(20)
    expect(container.get(A).c).toEqual(1)
  })

  it("Should respect the resolveSingletons call contract", async () => {
    // All the other code binds to objects, lets bind to a number (which is perfectly valid).
    async function fetchA(n: number) {
      return new Promise<number>((resolve, reject) => {
        setTimeout(() => {
          if (isNaN(n)) reject(new Error("Not a number"))
          else resolve(n)
        }, 25)
      })
    }

    const container = new Container()
    container
      .bindAsyncFactory("A", async () => {
        return await fetchA(1)
      }, {
        scope: "singleton"
      })

    container
      .bindAsyncFactory("B", async () => {
        return await fetchA(NaN)
      }, {
        scope: "singleton"
      })

    await container
      .whenReady()
      .then(() => {
        fail("resolveSingletons should have rejected")

      })
      .catch(err => {
        const reason = err instanceof ErrorReason ? err : undefined
        expect(reason).toBeInstanceOf(ErrorReason)
        expect(reason?.size).toBe(1)
        const r = reason?.get("B")
        expect(r).toBeDefined()
        expect(r?.message).toBe("Not a number")

      })
  })
  it("Should throw if you request an unresolved dependency tree", async () => {
    class A {
      constructor(public c: number) {}
    }

    async function fetchA() {
      return new Promise<A>(resolve => {
        setTimeout(() => {
          resolve(new A(1))
        }, 25)
      })
    }

    const container = new Container()

    function impatient() {
      container.get(A)
    }

    container
      .bindAsyncFactory(A, async () => {
        return await fetchA()
      }, {
        scope: "singleton"
      })


    expect(impatient).toThrowError(
      /Container has not finished initializing/
    )
  })
  it("Should support sync Factory with async PostConstruct in the dependency chain as long as resolve is used", async () => {
    @Injectable()
    class A {
      constructor() {}

      a: string

      @PostConstruct()
      init(): Promise<void> {
        return new Promise<void>(resolve => {
          setTimeout(() => {
            this.a = "A"
            resolve()
          }, 25)
        })
      }
    }

    @Injectable()
    class B {
      constructor(public a: A) {}
    }

    const container = new Container()
    container.bindClass(A,{
      scope: "singleton"
    })
    container.bindFactory(B, i => {
      return new B(i.get(A))
    })
    await container.whenReady() // This will resolve A which is an async singleton, so the factory will have immediate access to it.

    const b = container.get(B)
    expect(b.a.a).toEqual("A")
  })


  it("Multiple async in dependency tree should all properly resolve", async () => {
    class A {
      constructor() {
        this.a = "A"
      }

      a: string
    }

    async function fetchA() {
      return new Promise<A>(resolve => {
        setTimeout(() => {
          resolve(new A())
        }, 25)
      })
    }

    @Injectable()
    class B {
      constructor(public a: A) {
        expect(a).toBeDefined()
      }
    }

    @Injectable()
    class C {
      constructor(public b: B) {}
    }

    const container = new Container()
    container.bindClass(B)
    container.bindAsyncFactory(A, async () => {
      return await fetchA()
    })
    container.bindClass(C)
    const b = await container.resolve(B)

    expect(b.a.a).toEqual("A")
  })
  it("Failure in async dependency tree should propagate", async () => {
    class A {
      constructor() {}

      a: string
    }

    async function fetchA() {
      return new Promise<A>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error("Unable to create A"))
        }, 25)
      })
    }

    @Injectable()
    class B {
      constructor(public a: A) {}
    }

    @Injectable()
    class C {
      constructor(public b: B) {}
    }

    const container = new Container()
    container.bindClass(B)
    container.bindAsyncFactory(A, async () => {
      return await fetchA()
    })
    container.bindClass(C)

    container.resolve(B).then(
      () => {
        fail("Factory failures should not resolve")

      },
      err => {
        expect(err.message).toBe("Unable to create A")

      }
    )
  })
  it("Failure in async dependency tree should invoke ErrorHandler", async () => {
    class A {
      constructor() {}

      a: string
    }

    async function fetchA() {
      return new Promise<A>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error("Unable to create A"))
        }, 25)
      })
    }

    @Injectable()
    class B {
      constructor(public a: A) {}
    }

    const container = new Container()
    container.bindClass(B)
    container
      .bindAsyncFactory(A, async () => {
        return await fetchA()
      }, {
        onError: (injector, id: any, maker, error, value) => {
      expect(value).toBeUndefined() // We didn't create it, so nothing should be passed.
      return new Error("Unable to recover " + id.name)
    }
      })


    await container.resolve(B).then(
      () => {
        fail("Factory failures should not resolve")

      },
      err => {
        expect(err.message).toBe("Unable to recover A")
      }
    )
  })
  it("Failure in async dependency tree should allow ErrorHandler to provide alternative", async () => {
    class A {
      constructor() {
        this.a = "A"
      }

      a: string
    }

    async function fetchA() {
      return new Promise<A>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error("Unable to create A"))
        }, 25)
      })
    }

    @Injectable()
    class B {
      constructor(public a: A) {}
    }

    const container = new Container()
    container.bindClass(B)
    container
      .bindAsyncFactory(A, async () => {
        return await fetchA()
      }, {
        onError: (injector, id: any, maker, error, value) => {
          expect(value).toBeUndefined() // We didn't create it, so nothing should be passed.
          return new A()
        }
      })


    await container.resolve(B).then(
      b => {
        expect(b.a.a).toBe("A")
      },
      () => {
        fail("Factory failures should recover")
      }
    )
  })
})

describe("Container asynchronous hierarchy", () => {
  it("Should be able to get services from parent container", async () => {
    class A {
      constructor(public c: number) {}
    }

    async function fetchA() {
      return new Promise<A>(resolve => {
        setTimeout(() => {
          resolve(new A(1))
        }, 25)
      })
    }

    const root = new Container()
    root
      .bindAsyncFactory("A", async () => {
        return await fetchA()
      }, {
        scope: "singleton"
      })

    const child = new Container(root)
    const grandChild = new Container(child)
    await grandChild.whenReady()

    const a = grandChild.get<A>("A")
    expect(a instanceof A).toBeTruthy()
    expect(a.c).toEqual(1)
  })
  it("Should be able to get services from parent container", async () => {
    class A {
      constructor(public c: number) {}
    }

    async function fetchA() {
      return new Promise<A>(resolve => {
        setTimeout(() => {
          resolve(new A(1))
        }, 25)
      })
    }

    const root = new Container()
    root
      .bindAsyncFactory("A", async () => {
        return await fetchA()
      }, {
        scope: "singleton"
      })

    const child = new Container(root)
    const grandChild = new Container(child)

    const a = await grandChild.resolve<A>("A")
    expect(a instanceof A).toBeTruthy()
    expect(a.c).toEqual(1)
  })
})

describe("Edge cases", () => {
  it("Should successfully invoke resolve even on a fully synchronous dependency tree", async () => {
    @Injectable()
    @Scope("singleton")
    class A {
      constructor() {
        this.a = "A"
      }

      a: string
    }

    @Injectable()
    class B {
      constructor(public a: A) {}
    }

    const container = new Container()
    container.bindClass(A)
    container.bindClass(B)

    const b1 = await container.resolve(B)
    expect(b1 instanceof B).toBeTruthy()
    expect(b1.a.a).toEqual("A")
    const b2 = container.get(B)
    expect(b2 instanceof B).toBeTruthy()
  })
})

describe("Asynchronous error handling", () => {
  it("Async initialization followed by another Async PostConstruct which fails, should propagate the error", async () => {
    @Injectable()
    class A {
      constructor() {
        this.a = "A"
      }

      a: string

      @PostConstruct()
      init(): Promise<void> {
        return new Promise<void>(resolve => {
          setTimeout(() => {
            resolve()
          }, 25)
        })
      }
    }

    @Injectable()
    class B {
      constructor(public a: A) {}

      @PostConstruct()
      init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            reject(new Error("Failed post construction of B"))
          }, 25)
        })
      }
    }

    const container = new Container()
    container.bindClass(A)
    container.bindClass(B)

    await container.resolve(B).then(
      () => {
        fail("Rejected parameters should cause construction failure")

      },
      err => {
        expect(err.message).toBe("Failed post construction of B")

      }
    )
  })

  it("Pending constructor parameters that subsequently fail, should propagate the error", async () => {
    @Injectable()
    class A {
      constructor() {
        this.a = "A"
      }

      a: string

      @PostConstruct()
      init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            reject(new Error("Failed post construction of A"))
          }, 25)
        })
      }
    }

    @Injectable()
    class B {
      constructor(public a: A) {}
    }

    const container = new Container()
    container.bindClass(A)
    container.bindClass(B)

    await container
      .resolve(B)
      .then(() => {
        //fail('Rejected parameters should cause construction failure');

      })
      .catch(err => {
        //expect(err.message).toBe('Failed post construction of A');

      })
  })
})

export {}
