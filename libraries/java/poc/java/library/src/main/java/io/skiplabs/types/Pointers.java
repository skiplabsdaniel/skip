package io.skiplabs.types;

class Pointers {
  static long createB = 0L;
  static long createC = 0L;
  

  public static BPointer createB(double field1) {
    assert createB != 0L;
    return callCreateB(createB, field1);
  }

  public static CPointer createC(B field1) {
    assert createC != 0L;
    return callCreateC(createC, field1);
  }

  private native static BPointer callCreateB(long createB, double field1);
  private native static CPointer callCreateC(long createC, B field1);
}