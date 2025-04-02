package io.skiplabs.types;

public class APointer {
  private long handle;
  private long field1;
  private long field2;

  public APointer(long handle, long field1, long field2) {
    this.handle = handle;
    this.field1 = field1;
    this.field2 = field2;
  }

  public long getField1() {
    if (this.handle == 0L || this.field1 == 0L) throw new NullPointerException();
    return this.callField1(this.handle, this.field1);
  }

  public B getField2() {
    if (this.handle == 0L || this.field2 == 0L) throw new NullPointerException();
    return new B(this.callField2(this.handle, this.field2));
  }


  public void clear() {
    this.handle = 0L;
    this.field1 = 0L;
    this.field2 = 0L;
  }

  private native long callField1(long handler, long function);
  private native BPointer callField2(long handler, long function);

}