package io.skiplabs.types;

public class BPointer {
  private long handle;
  private long field1;

  public BPointer(long handle, long field1) {
    this.handle = handle;
    this.field1 = field1;
  }

  public double getField1() {
    if (this.handle == 0L || this.field1 == 0L) throw new NullPointerException();
    return this.callField1(this.handle, this.field1);
  }

  public void clear() {
    this.handle = 0L;
    this.field1 = 0L;
  }

  private native double callField1(long handler, long function);
}